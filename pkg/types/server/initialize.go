package server

import (
	"context"
	"encoding/json"

	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// Initialize will load the data from the backend and merge it with the data from the config
func (c *CartographerServer) Initialize() error {

	log.Infof("Reading data from config %s", c.Options.ConfigFile)

	addRequests, err := c.GetBackendData()
	if err != nil {
		return err
	}

	// Add all backend collected links
	for _, r := range addRequests {
		log.Debugf("Populating Cache for Backend ns %s", r.Request.GetNamespace())
		for _, link := range r.Request.GetLinks() {
			c.AddToCache(link, r.Request.GetNamespace())
			metrics.IncrementObjectCount("link", 1)
		}
	}

	// Last we Add the config set links/groups
	log.Debugf("Populating %s configured data", c.Options.ConfigFile)
	_, err = c.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links:     c.config.Links,
			Groups:    c.config.Groups,
			Namespace: proto.DefaultNamespace, // a temporary hack, we need to update the ingestion to read namespaces from the config file
		},
	})

	//todo: fix this to be an accurate number
	log.Infof("Loaded %d links, %d groups", len(c.config.Links), len(c.config.Groups))

	return err
}

// GetBackendData will query the backend and return a list of AddReqeusts for all namespaces
func (c *CartographerServer) GetBackendData() ([]*proto.CartographerAddRequest, error) {

	addRequests := make([]*proto.CartographerAddRequest, 0)

	// Data returned from GetNamespaces is map[nsname]nil
	for ns := range c.Backend.GetNamespaces().Data {
		// per ns we query for data to build Requests and append
		resp := c.Backend.Get(&backend.BackendRequest{
			Namespace: ns,
		})

		addRequest := &proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Namespace: ns,
			},
		}

		for _, value := range resp.Data {
			if len(value) == 0 {
				continue
			}

			link := &proto.Link{}
			if err := json.Unmarshal(value, link); err != nil {
				continue
			}

			if link.GetKey() != "" {
				addRequest.Request.Links = append(addRequest.Request.Links, link)
			}
		}

		addRequests = append(addRequests, addRequest)

	}

	return addRequests, nil
}
