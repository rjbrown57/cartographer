package server

import (
	"context"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

func (c *CartographerServer) Add(_ context.Context, in *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {
	return c.Backend.Add(in)
}

func (c *CartographerServer) Get(_ context.Context, in *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {
	return c.Backend.Get(in)
}

func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {
	return c.Backend.Delete(in)
}

func (c *CartographerServer) StreamGet(in *proto.CartographerStreamGetRequest, stream grpc.ServerStreamingServer[proto.CartographerStreamGetResponse]) error {
	// https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc
	return c.Backend.StreamGet(in, stream)
}
