package inmemory

import (
	"os"

	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"gopkg.in/yaml.v3"
)

// Export is used to provide data to a templating map, as well as facilitate backup / restore operations
func (i *InMemoryBackend) Export() *config.CartographerConfig {
	c := config.CartographerConfig{
		Links:  make([]*proto.Link, 0),
		Groups: make([]*proto.Group, 0),
	}

	// Process Links
	for _, link := range i.Links {
		l := proto.Link{
			Url:         link.Link.String(),
			Tags:        link.GetTagNames(),
			Description: link.Description,
			Displayname: link.DisplayName,
		}
		c.Links = append(c.Links, &l)
	}

	// Process Groups
	// replace with new
	for _, group := range i.Groups {
		g := proto.Group{
			Name: group.Name,
		}

		for _, tag := range group.GroupTags {
			g.Tags = append(g.Tags, tag.Name)
		}

		c.Groups = append(c.Groups, &g)
	}

	return &c
}

// Backup will write to file the current status of cartographer
func (i *InMemoryBackend) Backup() error {
	if !i.backupConfig.Enabled {
		return nil
	}
	currentConfig := i.Export()

	f, err := os.OpenFile(i.backupConfig.BackupPath, os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}

	bytes, err := yaml.Marshal(currentConfig)

	_, err = f.Write(bytes)
	if err != nil {
		return err
	}

	log.Printf("Backup written to %s", i.backupConfig.BackupPath)

	return nil
}
