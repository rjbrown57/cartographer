package server

import (
	"testing"
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

			if len(testServer.cache) == 0 {
				t.Fatalf("Cache is empty")
			}

			links, err := testServer.GetBackendData()
			if err != nil {
				t.Fatalf("Failed to get backend data: %v", err)
			}

			if len(links) != tt.expectedLinks {
				t.Fatalf("Expected %d links, got %d", tt.expectedLinks, len(links))
			}
		})
	}
}
