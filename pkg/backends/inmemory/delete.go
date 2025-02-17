package inmemory

import (
	"github.com/rjbrown57/cartographer/pkg/log"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func (b *InMemoryBackend) Delete(r *backend.BackendRequest) *backend.BackendResponse {

	resp := backend.NewBackendResponse()

	for _, key := range r.Key {
		log.Infof("Deleting key: %s", key)
		b.Data.Delete(key)
		resp.Data[key] = nil
	}

	return resp
}
