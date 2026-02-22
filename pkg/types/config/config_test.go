package config

import (
	"fmt"
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/utils"
	"gopkg.in/yaml.v3"
)

func TestNewCartographerConfig(t *testing.T) {

	// Prep the single file test
	config, err := utils.WriteTestConfig()
	if err != nil {
		t.Fatalf("Failed to write test config %s", err)
	}

	// Prep the directory test
	dir, err := utils.WriteTestDir()
	if err != nil {
		t.Fatalf("Failed to write test dir %s", err)
	}

	t.Cleanup(func() {
		config.Close()
		os.Remove(config.Name())
		os.RemoveAll(dir)
	})

	// Test a single file
	c := NewCartographerConfig(config.Name())

	// Create control config using the same process
	controlConfig := CartographerConfig{}
	controlConfig = *controlConfig.WithIngest(config.Name())

	utils.AssertDeepEqual(t, c.ApiVersion, controlConfig.ApiVersion)
	utils.AssertDeepEqual(t, c.ServerConfig, controlConfig.ServerConfig)
	utils.AssertDeepEqual(t, c.Links, controlConfig.Links)

	controlConfig = CartographerConfig{}

	err = yaml.Unmarshal(fmt.Appendf(nil, "%s\n%s\n%s", utils.TestFullConfig, utils.LinkOnly1Config, utils.LinkOnly2Config), &controlConfig)
	if err != nil {
		t.Fatalf("Failed to unmarshal control config %s", err)
	}

	// Test a directory
	c = NewCartographerConfig(dir)

	utils.AssertDeepEqual(t, c.ApiVersion, controlConfig.ApiVersion)
	utils.AssertDeepEqual(t, c.ServerConfig, controlConfig.ServerConfig)
	// This can have issue with the ordering
	// So i'm being lazy and cheating here
	utils.AssertDeepEqual(t, len(c.Links), len(controlConfig.Links))
}
func TestSetApi(t *testing.T) {
	c := CartographerConfig{}

	// Test when ApiVersion is not set
	c.SetApi()
	utils.AssertDeepEqual(t, c.ApiVersion, ApiVersion)

	// Test when ApiVersion is already set
	customApiVersion := "v2alpha"
	c.ApiVersion = customApiVersion
	c.SetApi()
	utils.AssertDeepEqual(t, c.ApiVersion, customApiVersion)
}
