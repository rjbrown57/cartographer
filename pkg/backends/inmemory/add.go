package inmemory

import (
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/data"
)

// TODO I hate this function
func (i *InMemoryBackend) Add(r *proto.CartographerRequest) (*proto.CartographerResponse, error) {

	resp := proto.CartographerResponse{Type: r.Type}

	newLinks := []*data.Link{}

	i.mu.Lock()
	defer i.mu.Unlock()

	// Process Links
	for _, link := range r.Links {
		if _, exists := i.Links[link.Url]; !exists {
			l, err := data.NewFromProtoLink(link)
			if err == nil {
				log.Printf("adding %s", l.Link.String())
				newLinks = append(newLinks, l)
				continue
			}
			log.Printf("error adding %s - %s", l.Link.String(), err)
			continue
		}

		log.Printf("Skipping known link %s", link)
	}

	// Process any tags
	for _, tag := range r.Tags {
		_ = i.Tags.NewTag(tag.Name)
		// Add links to tag
		i.Tags[tag.Name].Links = append(i.Tags[tag.Name].Links, newLinks...)

		// Add tag to links
		for _, link := range newLinks {
			link.Tags = append(link.Tags, i.Tags[tag.Name])
		}
	}

	for _, group := range r.Groups {
		// Create group if it doesn't exist
		if g := i.Groups.GetGroup(group.Name); g == nil {
			log.Printf("Adding Groups %s", group.Name)
			i.Groups[group.Name] = data.NewGroup(group.Name)
		}

		// Add all tags to group
		for _, tag := range r.Tags {
			log.Printf("Adding Tags to group %s %s", group.Name, r.Tags)
			i.Groups[group.Name].GroupTags = append(i.Groups[group.Name].GroupTags, i.Tags[tag.Name])
		}
	}

	// Add links to map, and response
	for _, link := range newLinks {
		i.Links[link.Link.String()] = link
		resp.Msg = append(resp.Msg, fmt.Sprintf("Adding %s", link.Link.String()))
	}

	// Send notification
	i.Notifier.Publish(resp)

	// This should happen asynchronously and not block the add response
	// This doesn't seem to have any impact to add/delete performance at 5000 links.
	// For basic human usage our initial use case this is fine.
	err := i.Backup()
	if err != nil {
		log.Printf("Error backing up %s - %s", i.backupConfig.BackupPath, err)
	}

	return &resp, nil
}
