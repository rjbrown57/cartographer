package boltdb

import (
	"fmt"
	"os"
	"slices"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
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

	db.Add(backend.NewBackendAddRequest(mapData))

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
			Ids: test.ids,
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
