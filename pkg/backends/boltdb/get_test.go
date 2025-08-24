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

	linkBytes, err := json.Marshal(testLink)
	if err != nil {
		t.Fatalf("Expected no errors, got %v", err)
	}

	mapData := map[string]any{
		"test": "test",
		"https://github.com/rjbrown57/cartographer": testLink,
	}

	var tests = []struct {
		name string
		keys []string
		want *backend.BackendResponse
	}{
		{
			name: "proto link 1",
			keys: []string{testLink.GetKey()},
			want: &backend.BackendResponse{
				Data: map[string][]byte{
					testLink.GetKey(): linkBytes,
				},
			},
		},
	}

	// Add all cases to the database
	addResp := db.Add(backend.NewBackendAddRequest(mapData))
	if len(addResp.Errors) > 0 {
		t.Fatalf("Expected no errors, got %v", addResp.Errors)
	}

	for _, tt := range tests {
		// Iterate over each test case
		t.Run(tt.name, func(t *testing.T) {

			// Get the data from the database
			resp := db.Get(backend.NewBackendRequest(tt.keys...))

			// Check for errors on the get
			if len(resp.Errors) > 0 {
				t.Fatalf("Expected no errors, got %v", resp.Errors)
			}

			// Check the number of keys returned
			if len(resp.Data) != len(tt.want.Data) {
				t.Fatalf("Expected %d data, got %d", len(tt.want.Data), len(resp.Data))
			}

			datalink := &proto.Link{}

			err := json.Unmarshal(resp.Data[testLink.GetId()], datalink)
			if err != nil {
				t.Fatalf("Expected no errors, got %v", err)
			}

			if !reflect.DeepEqual(datalink, testLink) {
				t.Fatalf("%s: Expected %s, got %s", tt.name, datalink, testLink)
			}
		})
	}
}
