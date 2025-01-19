package client

import (
	"context"
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type CartographerClient struct {
	Client     proto.CartographerClient
	ClientConn *grpc.ClientConn
	Ctx        context.Context
	Options    *CartographerClientOptions
}

type CartographerClientOptions struct {
	Address string
	Port    int
}

func (o *CartographerClientOptions) GetAddr() string {
	return fmt.Sprintf("%s:%d", o.Address, o.Port)
}

func NewCartographerClient(o *CartographerClientOptions) *CartographerClient {
	var err error

	c := CartographerClient{
		Options: o,
	}

	// TODO make this meaningful :)
	c.Ctx = context.TODO()

	c.ClientConn, err = grpc.NewClient(o.GetAddr(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Unable to connect to cartographer server %s", err)
	}

	c.Client = proto.NewCartographerClient(c.ClientConn)

	return &c
}
