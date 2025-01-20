package inmemory

import (
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (i *InMemoryBackend) Delete(r *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {

	resp := proto.CartographerDeleteResponse{
		Response: proto.NewCartographerResponse(),
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	// This should be abstracted to reduce repetiton
	// Process Links
	for _, link := range r.Request.Links {
		if _, exists := i.Links[link.Url]; exists {
			// TODO this will not remove from tags objects that contain this
			delete(i.Links, link.Url)
			resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("removed link %s", link.Url))
			log.Printf("deleting %s", link)
		}
	}

	// Process Tags
	for _, tag := range r.Request.Tags {
		if _, exists := i.Tags[tag.Name]; exists {
			delete(i.Tags, tag.Name)
			resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("removed tag %s", tag.Name))
			log.Printf("deleting %s", tag)
		}
	}

	for _, group := range r.Request.Groups {
		if _, exists := i.Groups[group.Name]; exists {
			delete(i.Groups, group.Name)
			resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("removed group %s", group.Name))
			log.Printf("deleting %s", group)
		}
	}

	// Send notification on change
	if len(resp.Response.Msg) > 0 {
		i.Notifier.Publish(resp.Response)
	}

	err := i.Backup()
	if err != nil {
		log.Printf("Error backing up %s - %s", i.backupConfig.BackupPath, err)
	}

	return &resp, nil
}
