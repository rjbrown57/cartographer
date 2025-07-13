package server

import (
	"context"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) Initialize() error {

	log.Infof("Reading data from config %s", c.Options.ConfigFile)

	// Hack, we should eventually work with creating the datamap and just using a vanilla backend request
	_, err := c.Add(context.Background(), &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links:  c.config.Links,
			Groups: c.config.Groups,
		},
	})

	log.Infof("Loaded %d links, %d groups", len(c.config.Links), len(c.config.Groups))

	return err
}
