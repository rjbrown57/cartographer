package server

import (
	"os"
	"strings"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/utils"
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
			expectedLinks: 3,
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var config *os.File
			var err error

			if tt.configFile == "" {
				// Use default test config for successful case
				config, err = utils.WriteTestConfig()
				if err != nil {
					t.Fatalf("Failed to write test config: %v", err)
				}
				defer func() {
					os.Remove(config.Name())
					os.Remove("/tmp/debugcartographer.db")
				}()
			}

			configPath := tt.configFile
			if config != nil {
				configPath = config.Name()
			}

			server := NewCartographerServer(&CartographerServerOptions{
				ConfigFile: configPath,
			})

			err = server.Initialize()
			if tt.expectError {
				if err == nil {
					t.Fatalf("Expected error but got none")
				}
				if tt.errorContains != "" && !strings.Contains(err.Error(), tt.errorContains) {
					t.Fatalf("Expected error to contain '%s', got: %v", tt.errorContains, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("Failed to initialize server: %v", err)
			}

			if len(server.cache) == 0 {
				t.Fatalf("Cache is empty")
			}

			links, err := server.GetBackendData()
			if err != nil {
				t.Fatalf("Failed to get backend data: %v", err)
			}

			if len(links) != tt.expectedLinks {
				t.Fatalf("Expected %d links, got %d", tt.expectedLinks, len(links))
			}
		})
	}
}
