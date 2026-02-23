package server

import (
	"context"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

// TestAdd validates add behavior across success and invalid-namespace scenarios.
func TestAdd(t *testing.T) {
	tests := []struct {
		name        string
		request     *proto.CartographerAddRequest
		expectError bool
		namespace   string
		id          string
		url         string
	}{
		{
			name: "adds link and updates cache and backend",
			request: &proto.CartographerAddRequest{
				Request: &proto.CartographerRequest{
					Namespace: "add-test",
					Links: []*proto.Link{
						{
							Id:          "add-test-id",
							Url:         "https://example.com/add-test",
							Description: "add test link",
							Tags:        []string{"add", "server"},
						},
					},
				},
			},
			expectError: false,
			namespace:   "add-test",
			id:          "add-test-id",
			url:         "https://example.com/add-test",
		},
		{
			name: "returns error for invalid namespace",
			request: &proto.CartographerAddRequest{
				Request: &proto.CartographerRequest{
					Namespace: "INVALID_NAMESPACE",
					Links: []*proto.Link{
						{
							Id:  "invalid-ns-add-id",
							Url: "https://example.com/invalid-ns",
						},
					},
				},
			},
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.expectError {
				t.Cleanup(func() {
					_, _ = testServer.Delete(context.Background(), &proto.CartographerDeleteRequest{
						Namespace: tc.namespace,
						Ids:       []string{tc.id},
					})
				})
			}

			resp, err := testServer.Add(context.Background(), tc.request)
			if tc.expectError {
				if err == nil {
					t.Fatal("expected error for invalid namespace, got nil")
				}
				if resp != nil {
					t.Fatalf("expected nil response for invalid namespace, got %+v", resp)
				}
				return
			}

			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if resp == nil || resp.Response == nil {
				t.Fatal("expected non-nil add response")
			}
			if got := len(resp.Response.GetLinks()); got != 1 {
				t.Fatalf("expected 1 returned link, got %d", got)
			}
			if got := resp.Response.GetLinks()[0].GetKey(); got != tc.id {
				t.Fatalf("expected returned link key %q, got %q", tc.id, got)
			}

			testServer.mu.RLock()
			cachedNS, ok := testServer.nsCache[tc.namespace]
			if !ok {
				testServer.mu.RUnlock()
				t.Fatalf("expected namespace %q to exist in cache", tc.namespace)
			}
			cachedLink, ok := cachedNS.LinkCache[tc.id]
			testServer.mu.RUnlock()
			if !ok {
				t.Fatalf("expected link %q to exist in namespace cache", tc.id)
			}
			if got := cachedLink.GetUrl(); got != tc.url {
				t.Fatalf("expected cached link url %q, got %q", tc.url, got)
			}

			backendResp := testServer.Backend.Get(backend.NewBackendRequest(tc.namespace, tc.id))
			if backendResp == nil {
				t.Fatal("expected non-nil backend response")
			}
			if got := backendResp.Data[tc.id]; got == nil {
				t.Fatalf("expected backend to store bytes for key %q", tc.id)
			}
		})
	}
}
