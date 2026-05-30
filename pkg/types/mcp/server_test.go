package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"
)

type fakeCartographerClient struct {
	lastRequest *proto.CartographerGetRequest
	response    *proto.CartographerGetResponse
}

// Get records a request and returns a canned Cartographer response.
func (f *fakeCartographerClient) Get(_ context.Context, in *proto.CartographerGetRequest, _ ...grpc.CallOption) (*proto.CartographerGetResponse, error) {
	f.lastRequest = in
	return f.response, nil
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
	if got := len(tools); got != 3 {
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
