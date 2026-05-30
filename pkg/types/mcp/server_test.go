package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"
)

type fakeCartographerClient struct {
	lastRequest *proto.CartographerGetRequest
	lastAdd     *proto.CartographerAddRequest
	response    *proto.CartographerGetResponse
	addResponse *proto.CartographerAddResponse
}

// Get records a request and returns a canned Cartographer response.
func (f *fakeCartographerClient) Get(_ context.Context, in *proto.CartographerGetRequest, _ ...grpc.CallOption) (*proto.CartographerGetResponse, error) {
	f.lastRequest = in
	return f.response, nil
}

// Add records a request and returns a canned Cartographer add response.
func (f *fakeCartographerClient) Add(_ context.Context, in *proto.CartographerAddRequest, _ ...grpc.CallOption) (*proto.CartographerAddResponse, error) {
	f.lastAdd = in
	if f.addResponse != nil {
		return f.addResponse, nil
	}
	return &proto.CartographerAddResponse{Response: &proto.CartographerResponse{Notes: in.GetRequest().GetNotes()}}, nil
}

// TestServerInitializeAndListTools verifies the MCP handshake and tool catalog.
func TestServerInitializeAndListTools(t *testing.T) {
	client := &fakeCartographerClient{}
	input := strings.NewReader(
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}` + "\n" +
			`{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}` + "\n",
	)
	var output strings.Builder

	server := NewServer(context.Background(), client, input, &output)
	if err := server.Serve(); err != nil {
		t.Fatalf("Serve() error = %v", err)
	}

	decoder := json.NewDecoder(strings.NewReader(output.String()))
	var initResp map[string]any
	if err := decoder.Decode(&initResp); err != nil {
		t.Fatalf("decode initialize response: %v", err)
	}
	if got := initResp["jsonrpc"]; got != "2.0" {
		t.Fatalf("expected jsonrpc 2.0, got %v", got)
	}

	var toolsResp map[string]any
	if err := decoder.Decode(&toolsResp); err != nil {
		t.Fatalf("decode tools response: %v", err)
	}
	result := toolsResp["result"].(map[string]any)
	tools := result["tools"].([]any)
	if got := len(tools); got != 4 {
		t.Fatalf("expected 3 tools, got %d", got)
	}
}

// TestServerSearchNotes verifies a search tool call maps arguments to a Cartographer get request.
func TestServerSearchNotes(t *testing.T) {
	data, err := structpb.NewStruct(map[string]any{"source": "test"})
	if err != nil {
		t.Fatalf("NewStruct() error = %v", err)
	}

	client := &fakeCartographerClient{
		response: &proto.CartographerGetResponse{
			Response: &proto.CartographerResponse{
				Notes: []*proto.Note{{
					Id:    "note-1",
					Title: "First note",
					Body:  "body",
					Tags:  []string{"thought"},
					Data:  data,
				}},
			},
		},
	}
	input := strings.NewReader(`{"jsonrpc":"2.0","id":"call-1","method":"tools/call","params":{"name":"cartographer_search_notes","arguments":{"namespace":"research","terms":["body"],"tags":["thought"],"limit":5}}}` + "\n")
	var output strings.Builder

	server := NewServer(context.Background(), client, input, &output)
	if err := server.Serve(); err != nil {
		t.Fatalf("Serve() error = %v", err)
	}

	if got := client.lastRequest.GetRequest().GetNamespace(); got != "research" {
		t.Fatalf("expected namespace research, got %q", got)
	}
	if got := client.lastRequest.GetRequest().GetTerms(); len(got) != 1 || got[0] != "body" {
		t.Fatalf("expected term body, got %v", got)
	}
	if got := client.lastRequest.GetRequest().GetTags(); len(got) != 1 || got[0].GetName() != "thought" {
		t.Fatalf("expected tag thought, got %v", got)
	}

	var response struct {
		Result toolResult `json:"result"`
	}
	if err := json.NewDecoder(strings.NewReader(output.String())).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Result.Content) != 1 || !strings.Contains(response.Result.Content[0].Text, "note-1") {
		t.Fatalf("expected note payload in tool content, got %+v", response.Result)
	}
}

// TestServerAddNote verifies an add tool call maps arguments to a Cartographer add request.
func TestServerAddNote(t *testing.T) {
	client := &fakeCartographerClient{}
	input := strings.NewReader(`{"jsonrpc":"2.0","id":"add-1","method":"tools/call","params":{"name":"cartographer_add_note","arguments":{"namespace":"research","id":"note-2","title":"Second note","body":"markdown body","url":"https://example.com","tags":["thought","mcp"],"data":{"source":"test"},"created_at":"2026-05-30T19:00:00Z","updated_at":"2026-05-30T19:10:00Z","source":"mcp-test","author":"codex","version":7}}}` + "\n")
	var output strings.Builder

	server := NewServer(context.Background(), client, input, &output)
	if err := server.Serve(); err != nil {
		t.Fatalf("Serve() error = %v", err)
	}

	if client.lastAdd == nil {
		t.Fatal("expected add request")
	}
	if got := client.lastAdd.GetRequest().GetNamespace(); got != "research" {
		t.Fatalf("expected namespace research, got %q", got)
	}

	notes := client.lastAdd.GetRequest().GetNotes()
	if got := len(notes); got != 1 {
		t.Fatalf("expected one note, got %d", got)
	}

	note := notes[0]
	if got := note.GetId(); got != "note-2" {
		t.Fatalf("expected id note-2, got %q", got)
	}
	if got := note.GetTitle(); got != "Second note" {
		t.Fatalf("expected title Second note, got %q", got)
	}
	if got := note.GetBody(); got != "markdown body" {
		t.Fatalf("expected body markdown body, got %q", got)
	}
	if got := note.GetTags(); len(got) != 2 || got[0] != "thought" || got[1] != "mcp" {
		t.Fatalf("expected tags thought,mcp, got %v", got)
	}
	if got := note.GetData().AsMap()["source"]; got != "test" {
		t.Fatalf("expected data source test, got %v", got)
	}
	if got := note.GetCreatedAt().AsTime().Format(time.RFC3339); got != "2026-05-30T19:00:00Z" {
		t.Fatalf("expected created_at timestamp, got %q", got)
	}
	if got := note.GetUpdatedAt().AsTime().Format(time.RFC3339); got != "2026-05-30T19:10:00Z" {
		t.Fatalf("expected updated_at timestamp, got %q", got)
	}
	if got := note.GetSource(); got != "mcp-test" {
		t.Fatalf("expected source mcp-test, got %q", got)
	}
	if got := note.GetAuthor(); got != "codex" {
		t.Fatalf("expected author codex, got %q", got)
	}
	if got := note.GetVersion(); got != 7 {
		t.Fatalf("expected version 7, got %d", got)
	}

	var response struct {
		Result toolResult `json:"result"`
	}
	if err := json.NewDecoder(strings.NewReader(output.String())).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Result.Content) != 1 || !strings.Contains(response.Result.Content[0].Text, "note-2") {
		t.Fatalf("expected added note payload in tool content, got %+v", response.Result)
	}
}

// TestServerAddNoteRejectsReservedNamespace verifies MCP writes cannot mutate admin storage.
func TestServerAddNoteRejectsReservedNamespace(t *testing.T) {
	client := &fakeCartographerClient{}
	input := strings.NewReader(`{"jsonrpc":"2.0","id":"add-reserved","method":"tools/call","params":{"name":"cartographer_add_note","arguments":{"namespace":"cartographer-admin","id":"template/bad","title":"Bad","body":"bad"}}}` + "\n")
	var output strings.Builder

	server := NewServer(context.Background(), client, input, &output)
	if err := server.Serve(); err != nil {
		t.Fatalf("Serve() error = %v", err)
	}

	if client.lastAdd != nil {
		t.Fatal("expected reserved namespace request to skip add")
	}

	var response struct {
		Result toolResult `json:"result"`
	}
	if err := json.NewDecoder(strings.NewReader(output.String())).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Result.IsError || !strings.Contains(response.Result.Content[0].Text, "reserved namespace") {
		t.Fatalf("expected reserved namespace error, got %+v", response.Result)
	}
}
