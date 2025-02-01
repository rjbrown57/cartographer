package inmemory

import (
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestGet(t *testing.T) {

	b := NewInMemoryBackend()

	b.Data.Store("key1", "value1")

	r := b.Get(&backend.BackendRequest{
		Key: []string{"key1"}})

	if r.Errors != nil {
		t.Errorf("Expected no errors, got %v", r.Errors)
	}

	if r.Data["key1"] != "value1" {
		t.Errorf("Expected value1 for key1, got %v", r.Data["key1"])
	}
}

func TestGetAllValues(t *testing.T) {
	b := NewInMemoryBackend()

	b.Data.Store("key1", "value")
	b.Data.Store("key2", 42)

	r := b.GetAllValues()
	if r.Errors != nil {
		t.Errorf("Expected no errors, got %v", r.Errors)
	}

	if r.Data["key1"] != "value" {
		t.Errorf("Expected value for key1, got %v", r.Data["key1"])
	}

	if r.Data["key2"] != 42 {
		t.Errorf("Expected 42 for key2, got %v", r.Data["key2"])
	}
}

func TestGetKeys(t *testing.T) {
	b := NewInMemoryBackend()

	b.Data.Store("key1", "value")
	b.Data.Store("key2", 42)

	r := b.GetKeys()

	if r.Errors != nil {
		t.Errorf("Expected no errors, got %v", r.Errors)
	}

	if len(r.Data) != 2 {
		t.Errorf("Expected 2 keys, got %v", len(r.Data))
	}
}
