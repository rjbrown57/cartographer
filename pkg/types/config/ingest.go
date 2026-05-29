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

// IngestConfig is used to ingest data from a yaml file.
type IngestConfig struct {
	ApiVersion   string          `yaml:"apiVersion,omitempty"`
	Namespace    string          `yaml:"namespace,omitempty"`
	AutoTags     []*auto.AutoTag `yaml:"autotags,omitempty"`
	ServerConfig ServerConfig    `yaml:"cartographer,omitempty"`
	Notes        []*YamlNote     `yaml:"notes,omitempty"`
	Links        []*YamlLink     `yaml:"links,omitempty"`
}

// Convert converts YAML note and legacy link entries into canonical notes.
func (i *IngestConfig) Convert() *CartographerConfig {

	notes := []*proto.Note{}
	namespacedNotes := make(map[string][]*proto.Note)
	ns, err := proto.GetNamespace(i.Namespace)
	if err != nil {
		log.Fatalf("Error validating namespace %q: %s", i.Namespace, err)
	}

	for _, n := range i.Notes {
		title := n.Title
		if title == "" {
			title = n.Displayname
		}
		body := n.Body
		if body == "" {
			body = n.Description
		}

		protoNote, err := proto.NewNoteBuilder().
			WithURL(n.URL).
			WithTitle(title).
			WithBody(body).
			WithTags(n.Tags).
			WithData(n.Data).
			WithId(n.Id).
			WithAnnotations(n.Annotations).
			Build()
		if err != nil {
			log.Fatalf("Error building note: %s", err)
		}

		notes = append(notes, protoNote)
		namespacedNotes[ns] = append(namespacedNotes[ns], protoNote)
	}

	for _, l := range i.Links {
		protoNote, err := proto.NewNoteBuilder().
			WithURL(l.URL).
			WithTitle(l.Displayname).
			WithBody(l.URL).
			WithDescription(l.Description).
			WithTags(l.Tags).
			WithData(l.Data).
			WithId(l.Id).
			WithAnnotations(l.Annotations).
			Build()
		if err != nil {
			log.Fatalf("Error building legacy link note: %s", err)
		}

		notes = append(notes, protoNote)
		namespacedNotes[ns] = append(namespacedNotes[ns], protoNote)
	}

	c := &CartographerConfig{
		Namespace:        ns,
		Notes:            notes,
		NotesByNamespace: namespacedNotes,
		AutoTags:         i.AutoTags,
		ServerConfig:     i.ServerConfig,
		ApiVersion:       i.ApiVersion,
	}

	log.Debugf("CartographerConfig: %+v", c)

	return c
}

// YamlNote is a struct that is used to ingest note data from a yaml file.
type YamlNote struct {
	URL         string            `yaml:"url"`
	Title       string            `yaml:"title"`
	Body        string            `yaml:"body"`
	Displayname string            `yaml:"displayname"`
	Description string            `yaml:"description"`
	Tags        []string          `yaml:"tags"`
	Data        map[string]any    `yaml:"data"`
	Id          string            `yaml:"id"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

// YamlLink is a struct that is used to ingest data from a yaml file.
// This legacy shape is normalized into notes during ingest.
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
			// Read the config file and merge notes/autotags.
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
	if c.Namespace == "" {
		c.Namespace = mc.Namespace
	}

	c.AutoTags = append(c.AutoTags, mc.AutoTags...)
	c.Notes = append(c.Notes, mc.Notes...)
	if c.NotesByNamespace == nil {
		c.NotesByNamespace = make(map[string][]*proto.Note)
	}
	for ns, notes := range mc.NotesByNamespace {
		c.NotesByNamespace[ns] = append(c.NotesByNamespace[ns], notes...)
	}
}
