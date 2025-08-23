package backend

import (
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

type Backend interface {
	Add(r *BackendAddRequest) *BackendResponse
	Delete(r *proto.CartographerDeleteRequest) *proto.CartographerDeleteResponse
	Get(r *BackendRequest) *BackendResponse
	GetKeys() *BackendResponse
	GetAllValues() *BackendResponse
	Close() error
}
