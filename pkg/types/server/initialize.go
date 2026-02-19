package server

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// Initialize will load the data from the backend and merge it with the data from the config
func (c *CartographerServer) Initialize() error {

	log.Infof("Reading data from config %s", c.Options.ConfigFile)

	links, err := c.GetBackendData()
	if err != nil {
		return err
	}

	// merge the links from the backend with the links from the config
	c.config.Links = deduplicateLinks(append(c.config.Links, links...))

	_, err = c.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links:     c.config.Links,
			Groups:    c.config.Groups,
			Namespace: "default", // a temporary hack, we need to update the ingestion to read namespaces from the config file
		},
	})

	if err != nil {
		return err
	}

	log.Infof("Loaded %d links, %d groups", len(c.config.Links), len(c.config.Groups))

	return err
}

func (c *CartographerServer) GetBackendData() ([]*proto.Link, error) {

	links := make([]*proto.Link, 0)

	resp := c.Backend.GetAllValues()

	if len(resp.Errors) > 0 {
		return nil, fmt.Errorf("errors: %v", resp.Errors)
	}

	for _, value := range resp.Data {
		// convert from []byte to *proto.Link
		link := &proto.Link{}
		err := json.Unmarshal(value, &link)
		if err != nil {
			log.Errorf("Error unmarshalling link: %v", err)
		}
		links = append(links, link)
	}

	return links, nil
}

func deduplicateLinks(links []*proto.Link) []*proto.Link {
	seen := make(map[string]struct{})
	deduplicated := make([]*proto.Link, 0)

	for _, link := range links {
		// if the link is not in the seen map, mark it as seen and add it to the deduplicated list
		if _, ok := seen[link.GetKey()]; !ok {
			seen[link.GetKey()] = struct{}{}
			deduplicated = append(deduplicated, link)
		}
	}

	return deduplicated
}
