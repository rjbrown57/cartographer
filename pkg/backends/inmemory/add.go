package inmemory

import (
	"github.com/rjbrown57/cartographer/pkg/log"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

// We need to re-think how we supply this, we should keep using BackendRequests
func (b *InMemoryBackend) Add(req *backend.BackendAddRequest) *backend.BackendResponse {

	resp := backend.NewBackendResponse()
	for key := range req.Data {
		b.Data.Store(key, req.Data[key])
		log.Debugf("Added %s of type %T %+v", key, req.Data[key], req.Data[key])
		resp.Data[key] = req.Data[key]
	}

	return resp
}
