package inmemory

import (
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/data"
)

// TODO I hate this function
// This should be refactored to be more efficient and less complex
// We should accept multiple links in a single request, and the tags sent along with the link should be honored
// We should not allow sending of tags outside of them being added to the link
func (i *InMemoryBackend) Add(r *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {

	resp := proto.CartographerAddResponse{
		Response: proto.NewCartographerResponse(),
	}

	newLinks := []*data.Link{}

	i.mu.Lock()
	defer i.mu.Unlock()

	// Process Links
	for _, link := range r.Request.Links {
		if _, exists := i.Links[link.Url]; !exists {

			l, err := data.NewFromProtoLink(link)
			if err == nil {
				for _, tag := range link.Tags {
					// If tag doesn't exist, create it
					if _, exists := i.Tags[tag]; !exists {
						i.Tags[tag] = data.NewTag(tag)
					}
					// Add link to tag, and tag to link
					i.Tags[tag].Links = append(i.Tags[tag].Links, l)
					l.Tags = append(l.Tags, i.Tags[tag])
				}

				log.Printf("adding %s", l.Link.String())
				newLinks = append(newLinks, l)
				continue
			}
			log.Printf("error adding %s - %s", l.Link.String(), err)
			continue
		}

		log.Printf("Skipping known link %s", link)
	}

	for _, group := range r.Request.Groups {
		// Create group if it doesn't exist
		if g := i.Groups.GetGroup(group.Name); g == nil {
			log.Printf("Adding Groups %s", group.Name)
			i.Groups[group.Name] = data.NewGroup(group.Name)
		}

		// Add all tags to group
		for _, tag := range r.Request.Tags {
			log.Printf("Adding Tags to group %s %s", group.Name, r.Request.Tags)
			i.Groups[group.Name].GroupTags = append(i.Groups[group.Name].GroupTags, i.Tags[tag.Name])
		}
	}

	// Add links to map, and response
	for _, link := range newLinks {
		i.Links[link.Link.String()] = link
		resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("Adding %s", link.Link.String()))
	}

	// Send notification on change
	if len(resp.Response.Msg) > 0 {
		i.Notifier.Publish(resp.Response)
	}

	// This should happen asynchronously and not block the add response
	// This doesn't seem to have any impact to add/delete performance at 5000 links.
	// For basic human usage our initial use case this is fine.
	err := i.Backup()
	if err != nil {
		log.Printf("Error backing up %s - %s", i.backupConfig.BackupPath, err)
	}

	return &resp, nil
}
