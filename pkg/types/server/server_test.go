package server

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/utils"
)

// Global test variables
var (
	testConfig string
	testServer *CartographerServer
)

// TestMain runs once before all tests in the package
func TestMain(m *testing.M) {
	var err error

	// Global setup - write test config once
	testConfig, err = utils.WriteTestDir()
	if err != nil {
		panic("Failed to write test config: " + err.Error())
	}

	// Create server once but don't start webserver
	testServer = NewCartographerServer(&CartographerServerOptions{
		ConfigFile: testConfig,
	})

	// Run all tests
	code := m.Run()

	// Global cleanup
	if testConfig != "" {
		os.RemoveAll(testConfig)
	}
	os.Remove("/tmp/debugcartographer.db")

	os.Exit(code)
}
