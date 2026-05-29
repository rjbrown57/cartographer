package config

import (
	"path/filepath"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/backends/boltdb"
)

// TestGetBackend verifies backend config builds the requested backend type.
func TestGetBackend(t *testing.T) {

	backend := BackendConfig{
		BackendType: "boltdb",
		BackendPath: filepath.Join(t.TempDir(), "cartographer.db"),
	}

	b := backend.GetBackend()

	switch b.(type) {
	case *boltdb.BoltDBBackend:
	default:
		t.Fatalf("Expected boltdb backend, got %T", b)
	}
}
