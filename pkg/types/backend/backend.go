package backend

import (
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

// Backends are used to for cartographer to work with different data stores.
type Backend interface {
	Add(r *proto.CartographerRequest) (*proto.CartographerResponse, error)
	Delete(r *proto.CartographerRequest) (*proto.CartographerResponse, error)
	Get(r *proto.CartographerRequest) (*proto.CartographerResponse, error)
	StreamGet(r *proto.CartographerRequest, stream proto.Cartographer_StreamGetServer) error
	Initialize(c *config.CartographerConfig) error
	Backup() error
}
