package boltdb

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
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
	}))

	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	// data is first returned as []byte, so we need to convert it to a string
	resp = db.GetAllValues()

	// convert the data to a string
	if val, ok := resp.Data["test"]; !ok {
		t.Fatalf("Expected test to be present, got %v", ok)
	} else {
		var jsonVal string
		err := json.Unmarshal(val, &jsonVal)
		if err != nil {
			t.Fatalf("Unable to unmarshal value: %v", err)
		}

		if jsonVal != "test" {
			t.Fatalf("Expected test, got %v", string(val))
		}
	}
}
