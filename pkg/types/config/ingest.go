package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

// IngestConfig is used to ingest data from a yaml file. This is mainly for the map[string]any{} data in links.
type IngestConfig struct {
	ApiVersion   string          `yaml:"apiVersion,omitempty"`
	AutoTags     []*auto.AutoTag `yaml:"autotags,omitempty"`
	ServerConfig ServerConfig    `yaml:"cartographer,omitempty"`
	Links        []*YamlLink     `yaml:"links,omitempty"`
}

// GetProtoLinks converts the YamlLink struct to a proto.Link struct
func (i *IngestConfig) Convert() *CartographerConfig {

	pl := []*proto.Link{}
	for _, l := range i.Links {

		protoLink, err := proto.NewLinkBuilder().
			WithURL(l.URL).
			WithDisplayName(l.Displayname).
			WithDescription(l.Description).
			WithTags(l.Tags).
			WithData(l.Data).
			WithId(l.Id).
			WithAnnotations(l.Annotations).
			Build()
		if err != nil {
			log.Fatalf("Error building link: %s", err)
		}
		pl = append(pl, protoLink)
	}

	c := &CartographerConfig{
		Links:        pl,
		AutoTags:     i.AutoTags,
		ServerConfig: i.ServerConfig,
		ApiVersion:   i.ApiVersion,
	}

	log.Debugf("CartographerConfig: %+v", c)

	return c
}

// YamlLink is a struct that is used to ingest data from a yaml file.
// This is mainly for the map[string]any data in links.
type YamlLink struct {
	URL         string            `yaml:"url"`
	Displayname string            `yaml:"displayname"`
	Description string            `yaml:"description"`
	Tags        []string          `yaml:"tags"`
	Data        map[string]any    `yaml:"data"`
	Id          string            `yaml:"id"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

// WithIngest is a builder for the CartographerConfig struct to ingest data from a yaml file
func (c *CartographerConfig) WithIngest(configPath string) *CartographerConfig {

	ic := IngestConfig{}

	info, err := os.Stat(configPath)
	if err != nil {
		log.Fatalf("error reading config path: %v", err)
	}

	// If a directory was supplied we will merge all *.yaml files found
	if info.IsDir() {
		c.MergeConfigDir(configPath)
		c.SetApi()
		return c
	}

	// Otherwise we will read the single file
	err = utils.UnmarshalYaml(configPath, &ic)
	if err != nil {
		log.Fatalf("error reading config: %v", err)
	}

	log.Debugf("IngestConfig: %+v", ic)

	return ic.Convert()
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
			// Read the config file and merge links/autotags.
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

	c.AutoTags = append(c.AutoTags, mc.AutoTags...)
	c.Links = append(c.Links, mc.Links...)
}
