package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

const protocolVersion = "2024-11-05"
const reservedAdminNamespace = "cartographer-admin"

// CartographerClient is the subset of the Cartographer gRPC client used by MCP tools.
type CartographerClient interface {
	Get(ctx context.Context, in *proto.CartographerGetRequest, opts ...grpc.CallOption) (*proto.CartographerGetResponse, error)
	Add(ctx context.Context, in *proto.CartographerAddRequest, opts ...grpc.CallOption) (*proto.CartographerAddResponse, error)
}

// Server handles MCP JSON-RPC requests over stdio-compatible streams.
type Server struct {
	client CartographerClient
	ctx    context.Context
	in     io.Reader
	out    io.Writer
}

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

type toolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

type toolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type toolResult struct {
	Content []toolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type searchArgs struct {
	Namespace string   `json:"namespace"`
	Terms     []string `json:"terms"`
	Tags      []string `json:"tags"`
	Limit     int      `json:"limit"`
}

type getNoteArgs struct {
	Namespace string `json:"namespace"`
	ID        string `json:"id"`
}

type addNoteArgs struct {
	Namespace string         `json:"namespace"`
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Body      string         `json:"body"`
	URL       string         `json:"url"`
	Tags      []string       `json:"tags"`
	Data      map[string]any `json:"data"`
}

type namespaceArgs struct{}

type mcpNote struct {
	ID    string         `json:"id"`
	Title string         `json:"title,omitempty"`
	URL   string         `json:"url,omitempty"`
	Body  string         `json:"body,omitempty"`
	Tags  []string       `json:"tags,omitempty"`
	Data  map[string]any `json:"data,omitempty"`
}

type notesPayload struct {
	Namespace string    `json:"namespace"`
	Count     int       `json:"count"`
	Notes     []mcpNote `json:"notes"`
}

type namespacesPayload struct {
	Namespaces []string `json:"namespaces"`
}

// NewServer builds an MCP server around a live Cartographer client and streams.
func NewServer(ctx context.Context, client CartographerClient, in io.Reader, out io.Writer) *Server {
	if ctx == nil {
		ctx = context.Background()
	}

	return &Server{
		client: client,
		ctx:    ctx,
		in:     in,
		out:    out,
	}
}

// Serve reads JSON-RPC messages until EOF and writes MCP responses.
func (s *Server) Serve() error {
	decoder := json.NewDecoder(s.in)
	encoder := json.NewEncoder(s.out)

	for {
		var req rpcRequest
		if err := decoder.Decode(&req); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}

		resp, shouldRespond := s.handle(req)
		if !shouldRespond {
			continue
		}
		if err := encoder.Encode(resp); err != nil {
			return err
		}
	}
}

// handle routes one MCP JSON-RPC request.
func (s *Server) handle(req rpcRequest) (rpcResponse, bool) {
	if len(req.ID) == 0 {
		return rpcResponse{}, false
	}

	resp := rpcResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "initialize":
		resp.Result = map[string]any{
			"protocolVersion": protocolVersion,
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"serverInfo": map[string]any{
				"name":    "cartographer",
				"version": "dev",
			},
		}
	case "tools/list":
		resp.Result = map[string]any{"tools": tools()}
	case "tools/call":
		result, err := s.callTool(req.Params)
		if err != nil {
			resp.Result = toolResult{
				IsError: true,
				Content: []toolContent{{
					Type: "text",
					Text: err.Error(),
				}},
			}
		} else {
			resp.Result = result
		}
	case "ping":
		resp.Result = map[string]any{}
	default:
		resp.Error = &rpcError{Code: -32601, Message: "method not found"}
	}

	return resp, true
}

// callTool dispatches a tools/call request to a Cartographer query.
func (s *Server) callTool(params json.RawMessage) (toolResult, error) {
	var call toolCallParams
	if err := json.Unmarshal(params, &call); err != nil {
		return toolResult{}, fmt.Errorf("invalid tool call params: %w", err)
	}

	switch call.Name {
	case "cartographer_search_notes":
		var args searchArgs
		if err := decodeArgs(call.Arguments, &args); err != nil {
			return toolResult{}, err
		}
		return s.searchNotes(args)
	case "cartographer_get_note":
		var args getNoteArgs
		if err := decodeArgs(call.Arguments, &args); err != nil {
			return toolResult{}, err
		}
		return s.getNote(args)
	case "cartographer_add_note":
		var args addNoteArgs
		if err := decodeArgs(call.Arguments, &args); err != nil {
			return toolResult{}, err
		}
		return s.addNote(args)
	case "cartographer_list_namespaces":
		var args namespaceArgs
		if err := decodeArgs(call.Arguments, &args); err != nil {
			return toolResult{}, err
		}
		return s.listNamespaces()
	default:
		return toolResult{}, fmt.Errorf("unknown tool %q", call.Name)
	}
}

// searchNotes runs a namespace-scoped tag and term query against Cartographer.
func (s *Server) searchNotes(args searchArgs) (toolResult, error) {
	namespace, err := proto.GetNamespace(args.Namespace)
	if err != nil {
		return toolResult{}, err
	}

	terms := cleanStrings(args.Terms)
	tags := cleanStrings(args.Tags)
	if len(terms) == 0 && len(tags) == 0 {
		return toolResult{}, errors.New("at least one search term or tag is required")
	}

	req := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Tags:      tagsFromNames(tags),
			Terms:     terms,
			Namespace: namespace,
		},
		Type: proto.RequestType_REQUEST_TYPE_DATA,
	}

	resp, err := s.client.Get(s.ctx, req)
	if err != nil {
		return toolResult{}, err
	}

	return notesResult(namespace, resp.GetResponse().GetNotes(), args.Limit)
}

// getNote fetches one note by exact ID from a namespace.
func (s *Server) getNote(args getNoteArgs) (toolResult, error) {
	if strings.TrimSpace(args.ID) == "" {
		return toolResult{}, errors.New("id is required")
	}

	namespace, err := proto.GetNamespace(args.Namespace)
	if err != nil {
		return toolResult{}, err
	}

	req := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespace,
			Notes:     []*proto.Note{{Id: args.ID}},
		},
		Type: proto.RequestType_REQUEST_TYPE_DATA,
	}

	resp, err := s.client.Get(s.ctx, req)
	if err != nil {
		return toolResult{}, err
	}

	return notesResult(namespace, resp.GetResponse().GetNotes(), 1)
}

// addNote creates a new note through the live Cartographer add path.
func (s *Server) addNote(args addNoteArgs) (toolResult, error) {
	namespace, err := proto.GetNamespace(args.Namespace)
	if err != nil {
		return toolResult{}, err
	}
	if namespace == reservedAdminNamespace {
		return toolResult{}, errors.New("reserved namespace")
	}

	note, err := proto.NewNoteBuilder().
		WithId(resolveNoteID(args.ID, args.URL)).
		WithTitle(strings.TrimSpace(args.Title)).
		WithBody(strings.TrimSpace(args.Body)).
		WithURL(strings.TrimSpace(args.URL)).
		WithTags(cleanStrings(args.Tags)).
		WithData(args.Data).
		Build()
	if err != nil {
		return toolResult{}, err
	}

	resp, err := s.client.Add(s.ctx, &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespace,
			Notes:     []*proto.Note{note},
		},
	})
	if err != nil {
		return toolResult{}, err
	}

	return notesResult(namespace, resp.GetResponse().GetNotes(), 1)
}

// listNamespaces returns the namespaces currently known to Cartographer.
func (s *Server) listNamespaces() (toolResult, error) {
	req := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{},
		Type:    proto.RequestType_REQUEST_TYPE_NAMESPACE,
	}

	resp, err := s.client.Get(s.ctx, req)
	if err != nil {
		return toolResult{}, err
	}

	payload := namespacesPayload{Namespaces: resp.GetResponse().GetMsg()}
	return jsonToolResult(payload)
}

// tools returns the MCP tool definitions exposed by Cartographer.
func tools() []tool {
	return []tool{
		{
			Name:        "cartographer_search_notes",
			Description: "Search notes in a live Cartographer namespace by terms and/or tags. Requires at least one term or tag.",
			InputSchema: objectSchema(map[string]any{
				"namespace": stringSchema("Namespace to query. Defaults to default."),
				"terms":     arraySchema("Text terms that must match note title, body, URL, tags, or data."),
				"tags":      arraySchema("Tags that must match notes."),
				"limit":     integerSchema("Maximum notes to return. Defaults to 20, max 100."),
			}, []string{}),
		},
		{
			Name:        "cartographer_get_note",
			Description: "Fetch one exact note by ID from a live Cartographer namespace.",
			InputSchema: objectSchema(map[string]any{
				"namespace": stringSchema("Namespace to query. Defaults to default."),
				"id":        stringSchema("Exact note ID to fetch."),
			}, []string{"id"}),
		},
		{
			Name:        "cartographer_add_note",
			Description: "Create a note in a live Cartographer namespace. This writes to the backing Cartographer instance.",
			InputSchema: objectSchema(map[string]any{
				"namespace": stringSchema("Namespace to write into. Defaults to default."),
				"id":        stringSchema("Optional exact note ID. If omitted, URL-backed notes use the URL as ID."),
				"title":     stringSchema("Note title."),
				"body":      stringSchema("Markdown note body."),
				"url":       stringSchema("Optional URL associated with the note."),
				"tags":      arraySchema("Tags to attach to the note."),
				"data":      flexibleObjectSchema("Optional structured JSON object to attach to the note."),
			}, []string{}),
		},
		{
			Name:        "cartographer_list_namespaces",
			Description: "List namespaces available in the live Cartographer instance.",
			InputSchema: objectSchema(map[string]any{}, []string{}),
		},
	}
}

// resolveNoteID returns an explicit ID, URL-backed ID, or generated ID for note creation.
func resolveNoteID(id, noteURL string) string {
	if cleanedID := strings.TrimSpace(id); cleanedID != "" {
		return cleanedID
	}
	if cleanedURL := strings.TrimSpace(noteURL); cleanedURL != "" {
		return cleanedURL
	}
	return uuid.NewString()
}

// notesResult converts proto notes into a compact JSON MCP text result.
func notesResult(namespace string, notes []*proto.Note, limit int) (toolResult, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if len(notes) > limit {
		notes = notes[:limit]
	}

	payload := notesPayload{
		Namespace: namespace,
		Count:     len(notes),
		Notes:     make([]mcpNote, 0, len(notes)),
	}

	for _, note := range notes {
		payload.Notes = append(payload.Notes, mcpNote{
			ID:    note.GetId(),
			Title: note.GetTitle(),
			URL:   note.GetUrl(),
			Body:  note.GetBody(),
			Tags:  note.GetTags(),
			Data:  structAsMap(note),
		})
	}

	return jsonToolResult(payload)
}

// structAsMap returns protobuf Struct data as a JSON-like map.
func structAsMap(note *proto.Note) map[string]any {
	if note.GetData() == nil {
		return nil
	}
	return note.GetData().AsMap()
}

// jsonToolResult renders a payload as MCP text content.
func jsonToolResult(payload any) (toolResult, error) {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return toolResult{}, err
	}

	return toolResult{
		Content: []toolContent{{
			Type: "text",
			Text: string(data),
		}},
	}, nil
}

// decodeArgs decodes an optional MCP tool argument object.
func decodeArgs(raw json.RawMessage, out any) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("invalid tool arguments: %w", err)
	}
	return nil
}

// tagsFromNames maps tag names into proto Tag values.
func tagsFromNames(names []string) []*proto.Tag {
	cleaned := cleanStrings(names)
	tags := make([]*proto.Tag, 0, len(cleaned))
	for _, name := range cleaned {
		tags = append(tags, &proto.Tag{Name: name})
	}
	return tags
}

// cleanStrings trims empty values from arguments.
func cleanStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		cleaned := strings.TrimSpace(value)
		if cleaned != "" {
			out = append(out, cleaned)
		}
	}
	return out
}

// objectSchema creates a JSON schema object for MCP tool inputs.
func objectSchema(properties map[string]any, required []string) map[string]any {
	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}

// flexibleObjectSchema creates a JSON schema object that accepts arbitrary fields.
func flexibleObjectSchema(description string) map[string]any {
	return map[string]any{
		"type":        "object",
		"description": description,
	}
}

// stringSchema creates a JSON schema string property.
func stringSchema(description string) map[string]any {
	return map[string]any{
		"type":        "string",
		"description": description,
	}
}

// arraySchema creates a JSON schema string-array property.
func arraySchema(description string) map[string]any {
	return map[string]any{
		"type":        "array",
		"description": description,
		"items": map[string]any{
			"type": "string",
		},
	}
}

// integerSchema creates a JSON schema integer property.
func integerSchema(description string) map[string]any {
	return map[string]any{
		"type":        "integer",
		"description": description,
	}
}
