package server

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/utils"
)

// TODO make this a proper test
func TestInitialize(t *testing.T) {

	config, err := utils.WriteTestConfig()
	if err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	t.Cleanup(func() {
		os.Remove(config.Name())
	})

	server := NewCartographerServer(&CartographerServerOptions{
		ConfigFile: config.Name(),
	})

	err = server.Initialize()
	if err != nil {
		t.Fatalf("Failed to initialize server: %v", err)
	}

	if len(server.cache) == 0 {
		t.Fatalf("Cache is empty")
	}
}
