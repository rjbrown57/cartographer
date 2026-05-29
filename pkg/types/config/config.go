package config

import (
	"slices"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

const ApiVersion string = "v1beta"

type ServerConfig struct {
	Address   string        `yaml:"address,omitempty"`
	Port      int           `yaml:"port,omitempty"`
	WebConfig WebConfig     `yaml:"web,omitempty"`
	Backend   BackendConfig `yaml:"backend,omitempty"`
}

type WebConfig struct {
	Address  string `yaml:"address,omitempty"`
	Port     int    `yaml:"port,omitempty"`
	SiteName string `yaml:"siteName,omitempty"`
}

type CartographerConfig struct {
	ApiVersion   string          `yaml:"apiVersion,omitempty"`
	Namespace    string          `yaml:"namespace,omitempty"`
	AutoTags     []*auto.AutoTag `yaml:"autotags,omitempty"`
	ServerConfig ServerConfig    `yaml:"cartographer,omitempty"`
	Notes        []*proto.Note   `yaml:"notes,omitempty"`
	// NotesByNamespace is derived during ingest and is used for namespace-aware add paths.
	NotesByNamespace map[string][]*proto.Note `yaml:"-"`
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
	c.EnsureNotesByNamespace()

	resp := &proto.CartographerAddResponse{
		Response: &proto.CartographerResponse{},
	}

	namespaces := c.GetNamespaces()
	for _, ns := range namespaces {
		r := proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Notes:     c.NotesByNamespace[ns],
				Namespace: ns,
			},
		}

		addResp, err := client.Client.Add(client.Ctx, &r)
		if err != nil {
			return nil, err
		}

		if addResp != nil && addResp.Response != nil {
			resp.Response.Notes = append(resp.Response.Notes, addResp.Response.GetNotes()...)
		}
	}

	return resp, nil
}

// GetNamespaces returns configured namespaces sorted for deterministic iteration.
func (c *CartographerConfig) GetNamespaces() []string {
	c.EnsureNotesByNamespace()

	namespaces := make([]string, 0, len(c.NotesByNamespace))
	for ns := range c.NotesByNamespace {
		namespaces = append(namespaces, ns)
	}
	slices.Sort(namespaces)
	return namespaces
}

// EnsureNotesByNamespace backfills namespace buckets for legacy in-memory configs.
func (c *CartographerConfig) EnsureNotesByNamespace() {
	if len(c.NotesByNamespace) > 0 {
		return
	}

	c.NotesByNamespace = make(map[string][]*proto.Note)
	if len(c.Notes) == 0 {
		return
	}

	ns, err := proto.GetNamespace(c.Namespace)
	if err != nil {
		ns = proto.DefaultNamespace
	}
	c.NotesByNamespace[ns] = append(c.NotesByNamespace[ns], c.Notes...)
}
