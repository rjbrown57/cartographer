package config

import (
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

const ApiVersion string = "v1beta"

type ServerConfig struct {
	Address      string       `yaml:"address,omitempty"`
	BackupConfig BackupConfig `yaml:"backup,omitempty"`
	Port         int          `yaml:"port,omitempty"`
	WebConfig    WebConfig    `yaml:"web,omitempty"`
}

type BackupConfig struct {
	BackupPath string `yaml:"path,omitempty"`
	Enabled    bool   `yaml:"enabled,omitempty"`
}

type WebConfig struct {
	Address  string `yaml:"address,omitempty"`
	Port     int    `yaml:"port,omitempty"`
	SiteName string `yaml:"siteName,omitempty"`
}

type CartographerConfig struct {
	ApiVersion   string         `yaml:"apiVersion,omitempty"`
	ServerConfig ServerConfig   `yaml:"cartographer,omitempty"`
	Groups       []*proto.Group `yaml:"groups,omitempty"`
	Links        []*proto.Link  `yaml:"links,omitempty"`
}

func NewCartographerConfig(configPath string) *CartographerConfig {
	c := CartographerConfig{}
	err := utils.UnmarshalYaml(configPath, &c)
	if err != nil {
		log.Fatalf("error reading config: %v", err)
	}

	c.SetApi()

	return &c
}

func (c *CartographerConfig) SetApi() {
	if c.ApiVersion == "" {
		c.ApiVersion = ApiVersion
	}
}
