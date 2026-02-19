package boltdb

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func TestAdd(t *testing.T) {

	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	resp := db.Add(backend.NewBackendAddRequest(map[string]any{
		"test": "test",
	}, "default"))

	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	err := db.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)
		namespaceBucket := dataStoreBucket.Bucket([]byte("default"))
		if namespaceBucket == nil {
			t.Fatalf("Expected default namespace bucket to exist")
		}

		val := namespaceBucket.Get([]byte("test"))
		if val == nil {
			t.Fatalf("Expected test to be present")
		}

		var jsonVal string
		err := json.Unmarshal(val, &jsonVal)
		if err != nil {
			t.Fatalf("Unable to unmarshal value: %v", err)
		}

		if jsonVal != "test" {
			t.Fatalf("Expected test, got %v", string(val))
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Expected no errors, got %v", err)
	}
}
