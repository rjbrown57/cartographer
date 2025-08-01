package boltdb

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func (b *BoltDBBackend) Delete(r *backend.BackendRequest) *backend.BackendResponse {
	log.Debugf("Adding data to BoltDB backend: %+v", r)

	resp := backend.NewBackendResponse()
	// Start a transaction to add the data to the database
	err := b.db.Update(func(tx *bolt.Tx) error {
		// get the data_store bucket
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		// delete the data to the database
		for _, key := range r.Key {
			err := dataStoreBucket.Delete([]byte(key))
			if err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}
