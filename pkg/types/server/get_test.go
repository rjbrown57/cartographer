package server

import (
	"context"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestGetNamespaces verifies Get returns current namespace keys when requesting namespace data.
func TestGetNamespaces(t *testing.T) {
	const testNamespace = "get-namespaces-test"

	testServer.mu.Lock()
	testServer.nsCache.AddToCache(testNamespace, &proto.Link{Id: "l-get-namespaces"})
	testServer.mu.Unlock()
	defer func() {
		testServer.mu.Lock()
		delete(testServer.nsCache, testNamespace)
		testServer.mu.Unlock()
	}()

	req := &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Namespace: proto.DefaultNamespace,
		},
		Type: proto.RequestType_REQUEST_TYPE_NAMESPACE,
	}

	resp, err := testServer.Get(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if resp == nil || resp.Response == nil {
		t.Fatal("expected non-nil response")
	}

	if got := len(resp.Response.GetMsg()); got == 0 {
		t.Fatalf("expected at least one namespace, got %d", got)
	}

	seen := map[string]bool{}
	for _, ns := range resp.Response.GetMsg() {
		seen[ns] = true
	}

	if !seen[proto.DefaultNamespace] {
		t.Fatalf("expected namespace %q in response, got %v", proto.DefaultNamespace, resp.Response.GetMsg())
	}

	if !seen[testNamespace] {
		t.Fatalf("expected namespace %q in response, got %v", testNamespace, resp.Response.GetMsg())
	}
}
