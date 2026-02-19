package boltdb

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestGet(t *testing.T) {
	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	testLink := &proto.Link{
		Url:         "https://github.com/rjbrown57/cartographer",
		Displayname: "Cartographer",
		Description: "Cartographer is a tool for managing links",
		Tags:        []string{"test", "test2"},
		Id:          "https://github.com/rjbrown57/cartographer",
		Data:        nil,
	}

	resp := db.Add(backend.NewBackendAddRequest(map[string]any{
		testLink.GetKey(): testLink,
	}, "default"))
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	// Get the data from the default namespace.
	resp = db.Get(backend.NewBackendRequest("default", testLink.GetKey()))
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	datalink := &proto.Link{}
	err := json.Unmarshal(resp.Data[testLink.GetKey()], datalink)
	if err != nil {
		t.Fatalf("Expected no errors, got %v", err)
	}

	if !reflect.DeepEqual(datalink, testLink) {
		t.Fatalf("Expected %s, got %s", datalink, testLink)
	}

	// Ensure namespace isolation returns no value for the same key in another namespace.
	wrongNamespaceResp := db.Get(backend.NewBackendRequest("prod", testLink.GetKey()))
	if len(wrongNamespaceResp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", wrongNamespaceResp.Errors)
	}
	if wrongNamespaceResp.Data[testLink.GetKey()] != nil {
		t.Fatalf("Expected nil value for key %q in namespace %q", testLink.GetKey(), "prod")
	}
}

// TestGetAllKeysInNamespace verifies Get returns all key/value pairs when no keys are provided.
func TestGetAllKeysInNamespace(t *testing.T) {
	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	defaultSeed := map[string]any{
		"link-1": "default-value-1",
		"link-2": "default-value-2",
	}
	prodSeed := map[string]any{
		"link-a": "prod-value-a",
	}

	resp := db.Add(backend.NewBackendAddRequest(defaultSeed, "default"))
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	resp = db.Add(backend.NewBackendAddRequest(prodSeed, "prod"))
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	// No keys means return all data for the requested namespace.
	resp = db.Get(&backend.BackendRequest{Namespace: "default"})
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	if len(resp.Data) != len(defaultSeed) {
		t.Fatalf("Expected %d values, got %d", len(defaultSeed), len(resp.Data))
	}

	for k := range defaultSeed {
		if _, ok := resp.Data[k]; !ok {
			t.Fatalf("Expected key %q to be returned for namespace %q", k, "default")
		}
	}

	if _, ok := resp.Data["link-a"]; ok {
		t.Fatalf("Did not expect key %q from namespace %q", "link-a", "prod")
	}
}

// TestGetAllKeysMissingNamespace verifies Get with no keys returns empty data for a namespace bucket that does not exist.
func TestGetAllKeysMissingNamespace(t *testing.T) {
	tempDir := t.TempDir()

	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	resp := db.Get(&backend.BackendRequest{Namespace: "does-not-exist"})
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	if len(resp.Data) != 0 {
		t.Fatalf("Expected empty data set for missing namespace, got %d entries", len(resp.Data))
	}
}

// TestNamespaces verifies that multiple namespaces can be written and then listed by GetNamespaces.
func TestNamespaces(t *testing.T) {
	// Create an isolated filesystem location for this test run.
	tempDir := t.TempDir()

	// Initialize a BoltDB backend instance using the temporary test database path.
	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	// Ensure temporary files are cleaned up even when the test fails.
	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	// Table-driven cases make it easy to add namespace-listing scenarios over time.
	tests := []struct {
		name       string
		namespaces []string
	}{
		{
			name:       "multiple namespaces",
			namespaces: []string{"default", "prod", "staging"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Seed namespace buckets by writing one key per namespace through Add.
			for _, namespace := range tt.namespaces {
				resp := db.Add(backend.NewBackendAddRequest(map[string]any{
					"seed": namespace,
				}, namespace))
				if len(resp.Errors) > 0 {
					t.Fatalf("Expected no errors, got %v", resp.Errors)
				}
			}

			// Read back all namespaces currently registered in the backend.
			resp := db.GetNamespaces()
			if len(resp.Errors) > 0 {
				t.Fatalf("Expected no errors, got %v", resp.Errors)
			}

			// Validate that we got exactly the namespaces we inserted for this test case.
			if len(resp.Data) != len(tt.namespaces) {
				t.Fatalf("Expected %d namespaces, got %d", len(tt.namespaces), len(resp.Data))
			}

			// Validate namespace membership without relying on map iteration order.
			for _, namespace := range tt.namespaces {
				if _, ok := resp.Data[namespace]; !ok {
					t.Fatalf("Expected namespace %q to exist", namespace)
				}
			}
		})
	}
}

// TestGetAllValuesMultipleNamespaces verifies GetAllValues returns values across multiple namespaces.
func TestGetAllValuesMultipleNamespaces(t *testing.T) {
	// Create an isolated filesystem location for this test run.
	tempDir := t.TempDir()

	// Initialize a BoltDB backend instance using the temporary test database path.
	db := NewBoltDbBackend(&BoltDBBackendOptions{
		Path: fmt.Sprintf("%s/cartographer.db", tempDir),
	})

	// Ensure temporary files are cleaned up even when the test fails.
	t.Cleanup(func() {
		os.RemoveAll(tempDir)
	})

	// Seed two namespace buckets with independent key/value sets.
	seedData := map[string]map[string]any{
		"default": {
			"link-1": "default-value-1",
			"link-2": "default-value-2",
		},
		"prod": {
			"link-a": "prod-value-a",
			"link-b": "prod-value-b",
		},
	}

	expectedData := make(map[string][]byte)

	for namespace, values := range seedData {
		resp := db.Add(backend.NewBackendAddRequest(values, namespace))
		if len(resp.Errors) > 0 {
			t.Fatalf("Expected no errors, got %v", resp.Errors)
		}

		for key, bytes := range resp.Data {
			expectedData[namespace+"/"+key] = bytes
		}
	}

	// Read all values recursively from the backend and validate the full result set.
	resp := db.GetAllValues()
	if len(resp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", resp.Errors)
	}

	if len(resp.Data) != len(expectedData) {
		t.Fatalf("Expected %d values, got %d", len(expectedData), len(resp.Data))
	}

	for key, expectedValue := range expectedData {
		actualValue, ok := resp.Data[key]
		if !ok {
			t.Fatalf("Expected key %q to exist", key)
		}
		if !reflect.DeepEqual(actualValue, expectedValue) {
			t.Fatalf("Expected value %s for key %q, got %s", expectedValue, key, actualValue)
		}
	}
}
