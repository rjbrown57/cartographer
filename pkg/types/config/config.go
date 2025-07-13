package config

import (
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

const ApiVersion string = "v1beta"

type ServerConfig struct {
	Address   string    `yaml:"address,omitempty"`
	Port      int       `yaml:"port,omitempty"`
	WebConfig WebConfig `yaml:"web,omitempty"`
}

type WebConfig struct {
	Address  string `yaml:"address,omitempty"`
	Port     int    `yaml:"port,omitempty"`
	SiteName string `yaml:"siteName,omitempty"`
}

type CartographerConfig struct {
	ApiVersion   string          `yaml:"apiVersion,omitempty"`
	AutoTags     []*auto.AutoTag `yaml:"autotags,omitempty"`
	ServerConfig ServerConfig    `yaml:"cartographer,omitempty"`
	Groups       []*proto.Group  `yaml:"groups,omitempty"`
	Links        []*proto.Link   `yaml:"links,omitempty"`
}

func NewCartographerConfig(configPath string) *CartographerConfig {

	c := &CartographerConfig{}
	c = c.WithIngest(configPath)
	c.SetApi()

	// Set all auto tag regexes
	for _, a := range c.AutoTags {
		a.Configure()
	}

	return c
}

func (c *CartographerConfig) SetApi() {
	if c.ApiVersion == "" {
		c.ApiVersion = ApiVersion
	}
}

func (c *CartographerConfig) AddToBackend(client *client.CartographerClient) (*proto.CartographerAddResponse, error) {

	r := proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links:  c.Links,
			Groups: c.Groups,
		},
	}

	resp, err := client.Client.Add(client.Ctx, &r)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
