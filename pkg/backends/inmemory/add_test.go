package inmemory

import (
	"sync"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestInMemoryBackend_Add(t *testing.T) {
	tests := []struct {
		name string
		req  *backend.BackendAddRequest
	}{
		{
			name: "Add single item",
			req: &backend.BackendAddRequest{
				Data: map[string]interface{}{
					"key1": "value1",
				},
			},
		},
		{
			name: "Add multiple items",
			req: &backend.BackendAddRequest{
				Data: map[string]interface{}{
					"key1": "value1",
					"key2": 42,
					"key3": true,
				},
			},
		},
		{
			name: "Add no items",
			req: &backend.BackendAddRequest{
				Data: map[string]interface{}{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &InMemoryBackend{
				Data: sync.Map{},
			}
			resp := b.Add(tt.req)
			if resp == nil {
				t.Errorf("Expected non-nil response")
			}

			for key, expectedValue := range tt.req.Data {
				actualValue, ok := b.Data.Load(key)
				if !ok {
					t.Errorf("Expected key %s to be present", key)
				}
				if actualValue != expectedValue {
					t.Errorf("Expected value %v for key %s, got %v", expectedValue, key, actualValue)
				}
			}
		})
	}
}
