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
			// this will not remove from lgs/tags objects that are related to this
			delete(i.Links, link.Url)
			log.Printf("deleting %s", link)
		}
	}

	// Process Tags
	for _, tag := range r.Request.Tags {
		if _, exists := i.Tags[tag.Name]; exists {
			delete(i.Tags, tag.Name)
			resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("removed %s", tag))
			log.Printf("deleting %s", tag)
		}
	}

	for _, group := range r.Request.Groups {
		if _, exists := i.Groups[group.Name]; exists {
			delete(i.Groups, group.Name)
			resp.Response.Msg = append(resp.Response.Msg, fmt.Sprintf("removed %s", group))
			log.Printf("deleting %s", group)
		}
	}

	err := i.Backup()
	if err != nil {
		log.Printf("Error backing up %s - %s", i.backupConfig.BackupPath, err)
	}

	return &resp, nil
}
