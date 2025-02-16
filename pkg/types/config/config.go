package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/client"
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
	ApiVersion   string          `yaml:"apiVersion,omitempty"`
	AutoTags     []*auto.AutoTag `yaml:"autotags,omitempty"`
	ServerConfig ServerConfig    `yaml:"cartographer,omitempty"`
	Groups       []*proto.Group  `yaml:"groups,omitempty"`
	Links        []*proto.Link   `yaml:"links,omitempty"`
}

func NewCartographerConfig(configPath string) *CartographerConfig {
	c := CartographerConfig{}

	info, err := os.Stat(configPath)
	if err != nil {
		log.Fatalf("error reading config path: %v", err)
	}

	// If a directory was supplied we will merge all *.yaml files found
	if info.IsDir() {
		c.MergeConfigDir(configPath)
		c.SetApi()
		return &c
	}

	// Otherwise we will read the single file
	err = utils.UnmarshalYaml(configPath, &c)
	if err != nil {
		log.Fatalf("error reading config: %v", err)
	}

	c.SetApi()

	for _, a := range c.AutoTags {
		a.Configure()
	}

	return &c
}

func (c *CartographerConfig) SetApi() {
	if c.ApiVersion == "" {
		c.ApiVersion = ApiVersion
	}
}

func (c *CartographerConfig) MergeConfigDir(dirpath string) {

	files, err := os.ReadDir(dirpath)
	if err != nil {
		log.Fatalf("error reading directory: %v", err)
	}

	for _, file := range files {
		switch {
		// If the file is a directory recursively merge the config
		case file.IsDir() && !strings.HasPrefix(file.Name(), "."):
			c.MergeConfigDir(fmt.Sprintf("%s/%s", dirpath, file.Name()))
		// Skip non yaml files, and dot files
		case !strings.HasSuffix(file.Name(), ".yaml") || strings.HasPrefix(file.Name(), "."):
			continue
		default:
			// Read the config file and merge the groups and links
			mc := NewCartographerConfig(filepath.Join(dirpath, file.Name()))
			c.MergeConfig(mc)
		}
	}
}

func (c *CartographerConfig) MergeConfig(mc *CartographerConfig) {

	// Typically these values are set only in 1 file
	// But if they are set in multiple files we will use the last value
	if (ServerConfig{}) == c.ServerConfig {
		c.ServerConfig = mc.ServerConfig
		mc.SetApi()
	}

	for _, autoTag := range mc.AutoTags {
		c.AutoTags = append(c.AutoTags, autoTag)
	}

	for _, group := range mc.Groups {
		c.Groups = append(c.Groups, group)
	}

	for _, link := range mc.Links {
		c.Links = append(c.Links, link)
	}
}

func (c *CartographerConfig) AddToBackend(client *client.CartographerClient) ([]*proto.CartographerAddResponse, error) {

	responses := []*proto.CartographerAddResponse{}

	// Add all new links
	for _, link := range c.Links {
		r := proto.NewCartographerAddRequest([]string{link.GetUrl()}, link.GetTags(), nil)
		resp, err := client.Client.Add(client.Ctx, r)
		if err != nil {
			return nil, err
		}
		responses = append(responses, resp)
	}

	// Add all new groups
	for _, group := range c.Groups {
		r := proto.NewCartographerAddRequest(nil, group.GetTags(), []string{group.Name})
		resp, err := client.Client.Add(client.Ctx, r)
		if err != nil {
			return nil, err
		}
		responses = append(responses, resp)
	}

	return responses, nil
}
