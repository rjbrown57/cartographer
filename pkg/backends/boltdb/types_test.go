package boltdb

import (
	"fmt"
	"os"
	"testing"

	. "github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func TestBackendInterface(t *testing.T) {
	// Ensure that InMemoryBackend implements the Backend interface
	var _ Backend = &BoltDBBackend{}
}

func TestNewBackend(t *testing.T) {

	// create a temp directory
	tempDir := t.TempDir()

	backend := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	err := backend.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte(MetaBucket))
		if bucket == nil {
			return fmt.Errorf("bucket not found")
		}
		schema := bucket.Get([]byte("schema"))
		if string(schema) != SchemaVersion {
			return fmt.Errorf("schema version mismatch")
		}
		createdDate := bucket.Get([]byte("createdDate"))
		if createdDate == nil {
			return fmt.Errorf("createdDate not found")
		}
		updatedDate := bucket.Get([]byte("updatedDate"))
		if updatedDate == nil {
			return fmt.Errorf("updatedDate not found")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("Failed to view BoltDB backend: %v", err)
	}
}
