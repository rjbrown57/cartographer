package server

import (
	"context"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestPing validates the ping endpoint returns a successful pong response.
func TestPing(t *testing.T) {
	resp, err := testServer.Ping(context.Background(), &proto.PingRequest{Name: "test"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if got := resp.GetMessage(); got != "Pong" {
		t.Fatalf("expected message %q, got %q", "Pong", got)
	}
}
