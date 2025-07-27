package boltdb

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func (b *BoltDBBackend) Clear() *backend.BackendResponse {
	log.Debugf("Clearing data from BoltDB backend")

	resp := backend.NewBackendResponse()

	err := b.db.Update(func(tx *bolt.Tx) error {
		// get the data_store bucket
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		// delete the data_store bucket
		err := dataStoreBucket.DeleteBucket([]byte(DataStoreBucket))
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}
