package inmemory

import (
	"log"

	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/types/data"
)

// Needs to refactored to use Group/Tag/Link methods
func (i *InMemoryBackend) Initialize(c *config.CartographerConfig) error {

	// Create all Groups
	// Create all Tags
	// Create all Links

	log.Printf("Initializing inmemory backend with %d links", len(c.Links))

	// Process all links
	for _, link := range c.Links {

		auto.ProcessAutoTags(link, c.AutoTags)

		d, err := data.NewFromProtoLink(link)

		if err != nil {
			log.Printf("Issue processing %s", link.Url)
		}

		for _, tag := range link.Tags {
			if _, exists := i.Tags[tag]; !exists {
				i.Tags[tag] = data.NewTag(tag)
			}
			i.Tags[tag].Links = append(i.Tags[tag].Links, d)
			d.Tags = append(d.Tags, i.Tags[tag])
		}

		i.Links[link.Url] = d
	}

	// Process Groups
	for _, group := range c.Groups {
		d := data.NewGroup(group.Name)
		for _, tagName := range group.Tags {
			if tag, exists := i.Tags[tagName]; exists {
				d.GroupTags = append(d.GroupTags, tag)
				d.Links = append(d.Links, tag.Links...)
			}
		}
		i.Groups[group.Name] = d
	}

	log.Printf("backend initialized with %d groups %d tags %d links", len(i.Groups), len(i.Tags), len(i.Links))

	return nil
}
