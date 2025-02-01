package server

import (
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) Initialize() error {

	log.Printf("Reading data from config %s", c.Options.ConfigFile)

	// Hack, we should eventually work with creating the datamap and just using a vanilla backend request
	_, err := c.Add(nil, &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links:  c.config.Links,
			Groups: c.config.Groups,
		},
	})

	return err
}
