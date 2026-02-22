package server

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func TestInitialize(t *testing.T) {
	tests := []struct {
		name          string
		configFile    string
		expectedLinks int
		expectError   bool
		errorContains string
	}{
		{
			name:          "successful initialization with valid config",
			configFile:    "",
			expectedLinks: 5,
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			if len(testServer.nsCache) == 0 {
				t.Fatalf("Cache is empty")
			}

			defaultNS, ok := testServer.nsCache[proto.DefaultNamespace]
			if !ok {
				t.Fatalf("Failed to get backend data")
			}

			if len(defaultNS.LinkCache) != tt.expectedLinks {
				t.Fatalf("Expected %d links, got %d", tt.expectedLinks, len(defaultNS.LinkCache))
			}
		})
	}
}
