package inmemory

import (
	"sync"
	"testing"
)

func TestInMemoryBackend_Clear(t *testing.T) {
	backend := &InMemoryBackend{
		Data: sync.Map{},
	}

	// Add some data to the backend
	backend.Data.Store("key1", "value1")
	// Clear the backend
	backend.Clear()

	// Check if the backend is empty
	if _, ok := backend.Data.Load("key1"); ok {
		t.Errorf("Expected key1 to be removed from the backend")
	}
}
