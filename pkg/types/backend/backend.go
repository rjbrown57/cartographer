package backend

import (
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

// Backends are used to for cartographer to work with different data stores.
type Backend interface {
	Add(r *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error)
	Delete(r *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error)
	Get(r *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error)
	StreamGet(r *proto.CartographerStreamGetRequest, stream proto.Cartographer_StreamGetServer) error
	Initialize(c *config.CartographerConfig) error
	Backup() error
}
