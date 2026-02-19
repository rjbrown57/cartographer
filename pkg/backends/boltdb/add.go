package boltdb

import (
	"encoding/json"
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func (b *BoltDBBackend) Add(r *backend.BackendAddRequest) *backend.BackendResponse {
	log.Debugf("Adding data to BoltDB backend: %+v", r)

	resp := backend.NewBackendResponse()
	// Start a transaction to add the data to the database
	err := b.db.Update(func(tx *bolt.Tx) error {
		// get the data_store bucket
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		namespaceBucket, err := dataStoreBucket.CreateBucketIfNotExists([]byte(r.Namespace))
		if err != nil {
			return fmt.Errorf("error getting namespace bucket: %v", err)
		}

		// add the data to the database
		for key, value := range r.Data {
			bytes, err := json.Marshal(value)
			if err != nil {
				return fmt.Errorf("error marshalling value: %v", err)
			}
			namespaceBucket.Put([]byte(key), bytes)
			resp.Data[key] = bytes
		}
		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}
