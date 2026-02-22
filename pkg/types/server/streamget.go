package server

import (
	"errors"

	"google.golang.org/grpc"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// getStreamLinks returns a namespace-scoped snapshot of links for stream responses.
func (c *CartographerServer) getStreamLinks(ns string) []*proto.Link {
	c.mu.RLock()
	links := c.nsCache.GetLinks(ns)
	c.mu.RUnlock()
	return links
}

// StreamGet streams namespace-scoped link snapshots to the client when cache updates are published.
func (c *CartographerServer) StreamGet(in *proto.CartographerStreamGetRequest, stream grpc.ServerStreamingServer[proto.CartographerStreamGetResponse]) error {

	// https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc

	ns, err := proto.GetNamespace(in.GetRequest().GetNamespace())
	if err != nil {
		return errors.New("invalid namespace supplied")
	}

	s := proto.CartographerStreamGetResponse{
		Response: proto.NewCartographerResponse(),
	}

	s.Response.Namespace = ns
	s.Response.Links = c.getStreamLinks(ns)

	if err := stream.Send(&s); err != nil {
		return err
	}

	notifier := c.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go c.Notifier.Unsubscribe(stream.Context(), notifier.Id)

	for {
		<-notifier.Channel

		// Rebuild the response snapshot each tick to avoid duplicating links.
		s.Response.Links = c.getStreamLinks(ns)

		if err := stream.Send(&s); err != nil {
			return err
		}
	}
}
