package inmemory

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/utils"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

func (b *InMemoryBackend) Delete(r *backend.BackendRequest) *backend.BackendResponse {

	resp := backend.NewBackendResponse()

	for _, key := range r.Key {
		val, ok := b.Data.LoadAndDelete(key)
		if !ok {
			resp.Errors = append(resp.Errors, utils.KeyNotFoundError)
			continue
		}
		log.Debugf("Deleted %s from in-memory backend", key)
		resp.Data[key] = val
	}

	return resp
}
