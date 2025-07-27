package boltdb

import (
	"fmt"
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestDelete(t *testing.T) {
	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	mapData := map[string]any{
		"test": "test",
	}

	db.Add(backend.NewBackendAddRequest(mapData))

	resp := db.Delete(backend.NewBackendRequest("test"))

	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	resp = db.GetAllValues()

	if len(resp.Data) > 0 {
		t.Fatalf("Expected no data, got %v", resp.Data)
	}
}
