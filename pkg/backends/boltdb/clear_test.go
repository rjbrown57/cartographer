package boltdb

import (
	"fmt"
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestClear(t *testing.T) {
	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	db.Add(backend.NewBackendAddRequest(map[string]any{
		"test": "test",
	}, "default"))

	db.Clear()

}
