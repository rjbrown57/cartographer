package server

import (
	"context"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// this should also live in it's own package to allow versioning since this is the real response api

func (c *CartographerServer) Ping(_ context.Context, in *proto.PingRequest) (*proto.PingResponse, error) {
	return &proto.PingResponse{
		Message: "Pong",
	}, nil
}
