package config

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/backends/boltdb"
)

func TestGetBackend(t *testing.T) {

	t.Cleanup(func() {
		os.Remove("/tmp/cartographer.db")
	})

	backend := BackendConfig{
		BackendType: "boltdb",
		BackendPath: "/tmp/cartographer.db",
	}

	b := backend.GetBackend()

	switch b.(type) {
	case *boltdb.BoltDBBackend:
	default:
		t.Fatalf("Expected boltdb backend, got %T", b)
	}
}
