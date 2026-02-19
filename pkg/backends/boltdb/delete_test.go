package boltdb

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	bolt "go.etcd.io/bbolt"
)

func PrepareTestDB(t *testing.T) *BoltDBBackend {
	tempDir := t.TempDir()
	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	mapData := map[string]any{
		"test1":  "test1",
		"test2a": "test2a",
		"test2b": "test2b",
	}

	err := db.db.Update(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)
		namespaceBucket, err := dataStoreBucket.CreateBucketIfNotExists([]byte("default"))
		if err != nil {
			return fmt.Errorf("create namespace bucket: %w", err)
		}
		for key, value := range mapData {
			bytes, err := json.Marshal(value)
			if err != nil {
				return fmt.Errorf("marshal value for key %q: %w", key, err)
			}
			if err := namespaceBucket.Put([]byte(key), bytes); err != nil {
				return fmt.Errorf("put value for key %q: %w", key, err)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Expected no errors, got %v", err)
	}

	return db
}

func TestDelete(t *testing.T) {

	db := PrepareTestDB(t)

	tests := []struct {
		name        string
		ids         []string
		shouldError bool
		expectedIds []string
	}{
		{name: "delete one id", ids: []string{"test1"}, shouldError: false, expectedIds: []string{"test1"}},
		{name: "delete two ids", ids: []string{"test2a", "test2b"}, shouldError: false, expectedIds: []string{"test2a", "test2b"}},
		{name: "delete non-existent id", ids: []string{"test3"}, shouldError: true, expectedIds: []string{}},
	}

	for _, test := range tests {

		resp := db.Delete(&proto.CartographerDeleteRequest{
			Ids:       test.ids,
			Namespace: "default",
		})

		if resp.Errors != nil && !test.shouldError {
			t.Fatalf("Expected no errors, got %s", resp.Errors)
		}

		for _, id := range test.expectedIds {
			if !slices.Contains(resp.Ids, id) {
				t.Fatalf("Expected id %s to be in %s", id, resp.Ids)
			}
		}
	}
}
