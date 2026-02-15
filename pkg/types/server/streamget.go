package server

import (
	"google.golang.org/grpc"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) StreamGet(in *proto.CartographerStreamGetRequest, stream grpc.ServerStreamingServer[proto.CartographerStreamGetResponse]) error {

	// https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc

	s := proto.CartographerStreamGetResponse{
		Response: proto.NewCartographerResponse(),
	}

	c.mu.RLock()
	for _, v := range c.cache {
		s.Response.Links = append(s.Response.Links, v)
	}
	c.mu.RUnlock()

	if err := stream.Send(&s); err != nil {
		return err
	}

	notifier := c.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go c.Notifier.Unsubscribe(stream.Context(), notifier.Id)

	for {
		<-notifier.Channel
		c.mu.RLock()
		for _, v := range c.cache {
			s.Response.Links = append(s.Response.Links, v)
		}
		c.mu.RUnlock()

		if err := stream.Send(&s); err != nil {
			return err
		}
	}
}
