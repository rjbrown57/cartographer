package boltdb

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

func (b *BoltDBBackend) Get(r *backend.BackendRequest) *backend.BackendResponse {
	log.Debugf("Get data from BoltDB backend: %+v", r)

	resp := backend.NewBackendResponse()
	err := b.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		for _, key := range r.Key {
			b := dataStoreBucket.Get([]byte(key))
			resp.Data[key] = b
		}

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}

func (b *BoltDBBackend) GetKeys() *backend.BackendResponse {

	resp := backend.NewBackendResponse()
	err := b.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		// get the keys from the data_store bucket
		dataStoreBucket.ForEach(func(k []byte, v []byte) error {
			resp.Data[string(k)] = nil
			return nil
		})

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}

func (b *BoltDBBackend) GetAllValues() *backend.BackendResponse {
	log.Debugf("Get All Data from BoltDB backend")

	resp := backend.NewBackendResponse()
	err := b.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		dataStoreBucket.ForEach(func(k []byte, v []byte) error {
			resp.Data[string(k)] = v
			return nil
		})

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}
