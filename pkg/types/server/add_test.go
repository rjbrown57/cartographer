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
					Notes: []*proto.Note{
						{
							Id:   "add-test-id",
							Url:  "https://example.com/add-test",
							Body: "add test link",
							Tags: []string{"add", "server"},
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
					Notes: []*proto.Note{
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
			if got := len(resp.Response.GetNotes()); got != 1 {
				t.Fatalf("expected 1 returned link, got %d", got)
			}
			if got := resp.Response.GetNotes()[0].GetKey(); got != tc.id {
				t.Fatalf("expected returned link key %q, got %q", tc.id, got)
			}

			testServer.mu.RLock()
			cachedNS, ok := testServer.nsCache[tc.namespace]
			if !ok {
				testServer.mu.RUnlock()
				t.Fatalf("expected namespace %q to exist in cache", tc.namespace)
			}
			cachedLink, ok := cachedNS.NoteCache[tc.id]
			testServer.mu.RUnlock()
			if !ok {
				t.Fatalf("expected link %q to exist in namespace cache", tc.id)
			}
			if got := cachedLink.GetUrl(); got != tc.url {
				t.Fatalf("expected cached link url %q, got %q", tc.url, got)
			}
			if cachedLink.GetCreatedAt() == nil {
				t.Fatal("expected cached link created_at to be set")
			}
			if cachedLink.GetUpdatedAt() == nil {
				t.Fatal("expected cached link updated_at to be set")
			}
			if got := cachedLink.GetSource(); got != "cartographer" {
				t.Fatalf("expected cached link source cartographer, got %q", got)
			}
			if got := cachedLink.GetVersion(); got != 1 {
				t.Fatalf("expected cached link version 1, got %d", got)
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

// TestAddPreservesVersionForUnchangedContent verifies re-ingest does not create a revision.
func TestAddPreservesVersionForUnchangedContent(t *testing.T) {
	namespace := "add-version-test"
	id := "unchanged-note"
	t.Cleanup(func() {
		_, _ = testServer.Delete(context.Background(), &proto.CartographerDeleteRequest{
			Namespace: namespace,
			Ids:       []string{id},
		})
	})

	addNote := func(body string) *proto.Note {
		return &proto.Note{
			Id:    id,
			Title: "Stable note",
			Body:  body,
			Url:   "https://example.com/stable",
			Tags:  []string{"stable", "version"},
		}
	}

	if _, err := testServer.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespace,
			Notes:     []*proto.Note{addNote("unchanged body")},
		},
	}); err != nil {
		t.Fatalf("expected initial add to succeed: %v", err)
	}

	initial := cachedTestNote(t, namespace, id)
	initialUpdatedAt := initial.GetUpdatedAt().AsTime()
	if got := initial.GetVersion(); got != 1 {
		t.Fatalf("expected initial version 1, got %d", got)
	}

	if _, err := testServer.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespace,
			Notes:     []*proto.Note{addNote("unchanged body")},
		},
	}); err != nil {
		t.Fatalf("expected unchanged add to succeed: %v", err)
	}

	unchanged := cachedTestNote(t, namespace, id)
	if got := unchanged.GetVersion(); got != 1 {
		t.Fatalf("expected unchanged note to preserve version 1, got %d", got)
	}
	if got := unchanged.GetUpdatedAt().AsTime(); !got.Equal(initialUpdatedAt) {
		t.Fatalf("expected unchanged note to preserve updated_at %s, got %s", initialUpdatedAt, got)
	}

	if _, err := testServer.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Namespace: namespace,
			Notes:     []*proto.Note{addNote("changed body")},
		},
	}); err != nil {
		t.Fatalf("expected changed add to succeed: %v", err)
	}

	changed := cachedTestNote(t, namespace, id)
	if got := changed.GetVersion(); got != 2 {
		t.Fatalf("expected changed note to increment to version 2, got %d", got)
	}
}

// cachedTestNote returns a note from the test server cache.
func cachedTestNote(t *testing.T, namespace, id string) *proto.Note {
	t.Helper()

	testServer.mu.RLock()
	cachedNS, ok := testServer.nsCache[namespace]
	testServer.mu.RUnlock()
	if !ok {
		t.Fatalf("expected namespace %q to exist in cache", namespace)
	}

	cachedNS.mu.RLock()
	note, ok := cachedNS.NoteCache[id]
	cachedNS.mu.RUnlock()
	if !ok {
		t.Fatalf("expected note %q to exist in namespace cache", id)
	}

	return note
}
