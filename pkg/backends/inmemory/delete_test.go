package inmemory

import (
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestDelete(t *testing.T) {
	// Setup the in-memory backend and client
	b := NewInMemoryBackend()
	b.Data.Store("key1", "value1")

	resp := b.Delete(backend.NewBackendRequest("string", "key1"))
	if resp.Errors != nil {
		t.Errorf("Expected no errors, got %v", resp.Errors)
	}

	if _, ok := b.Data.Load("key1"); ok {
		t.Errorf("Expected key1 to be removed from the backend")
	}
}
