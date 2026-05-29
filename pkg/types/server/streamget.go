package server

import (
	"errors"

	"google.golang.org/grpc"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// getStreamNotes returns a namespace-scoped snapshot of notes for stream responses.
func (c *CartographerServer) getStreamNotes(ns string) []*proto.Note {
	c.mu.RLock()
	notes := c.nsCache.GetNotes(ns)
	c.mu.RUnlock()
	return notes
}

// StreamGet streams namespace-scoped note snapshots to the client when cache updates are published.
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
	s.Response.Notes = c.getStreamNotes(ns)

	if err := stream.Send(&s); err != nil {
		return err
	}

	notifier := c.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go c.Notifier.Unsubscribe(stream.Context(), notifier.Id)

	for {
		<-notifier.Channel

		// Rebuild the response snapshot each tick to avoid duplicating notes.
		s.Response.Notes = c.getStreamNotes(ns)

		if err := stream.Send(&s); err != nil {
			return err
		}
	}
}
