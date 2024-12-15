package config

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/utils"
	"gopkg.in/yaml.v3"
)

func TestNewCartographerConfig(t *testing.T) {

	config, err := utils.WriteTestConfig()
	if err != nil {
		t.Fatalf("Failed to write test config %s", err)
	}

	controlConfig := CartographerConfig{}

	err = yaml.Unmarshal([]byte(utils.TestFullConfig), &controlConfig)
	if err != nil {
		t.Fatalf("Failed to unmarshal control config %s", err)
	}

	t.Cleanup(func() {
		config.Close()
		os.Remove(config.Name())
	})

	c := NewCartographerConfig(config.Name())

	utils.AssertDeepEqual(t, c.ApiVersion, controlConfig.ApiVersion)
	utils.AssertDeepEqual(t, c.ServerConfig, controlConfig.ServerConfig)
	utils.AssertDeepEqual(t, c.Groups, controlConfig.Groups)
	utils.AssertDeepEqual(t, c.Links, controlConfig.Links)
}
