package inmemory

import (
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

func (b *InMemoryBackend) Get(req *backend.BackendRequest) *backend.BackendResponse {

	resp := backend.NewBackendResponse()
	var ok bool

	for _, key := range req.Key {
		if resp.Data[key], ok = b.Data.Load(key); !ok {
			resp.Errors = append(resp.Errors, utils.KeyNotFoundError)
			continue
		}
	}

	return resp
}

func (b *InMemoryBackend) GetKeys() *backend.BackendResponse {
	resp := backend.NewBackendResponse()

	b.Data.Range(func(key, value interface{}) bool {
		resp.Data[key.(string)] = nil
		return true
	})

	return resp
}

func (b *InMemoryBackend) GetAllValues() *backend.BackendResponse {
	resp := backend.NewBackendResponse()

	b.Data.Range(func(key, value interface{}) bool {
		resp.Data[key.(string)] = value
		return true
	})

	return resp
}
