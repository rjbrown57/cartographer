package boltdb

import (
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

// Get reads one or more keys from a specific namespace bucket.
func (b *BoltDBBackend) Get(r *backend.BackendRequest) *backend.BackendResponse {
	log.Debugf("Get data from BoltDB backend: %+v", r)

	resp := backend.NewBackendResponse()
	err := b.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)
		namespaceBucket := dataStoreBucket.Bucket([]byte(r.Namespace))
		if namespaceBucket == nil {
			for _, key := range r.Key {
				resp.Data[key] = nil
			}
			return nil
		}

		// If no keys set return everything
		if r.Key == nil {
			c := namespaceBucket.Cursor()
			for k, v := c.First(); k != nil; k, v = c.Next() {
				resp.Data[string(k)] = v
			}
			return nil
		}

		for _, key := range r.Key {
			bytes := namespaceBucket.Get([]byte(key))
			resp.Data[key] = bytes
		}

		return nil
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}

// GetNamespaces lists only namespace buckets under the data_store bucket.
func (b *BoltDBBackend) GetNamespaces() *backend.BackendResponse {

	resp := backend.NewBackendResponse()
	err := b.db.View(func(tx *bolt.Tx) error {
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		return dataStoreBucket.ForEach(func(k []byte, v []byte) error {
			if v != nil {
				return nil
			}
			if dataStoreBucket.Bucket(k) == nil {
				return fmt.Errorf("unexpected nil value for non-bucket key %q", string(k))
			}
			resp.Data[string(k)] = nil
			return nil
		})
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
		return collectBucketValues(dataStoreBucket, "", resp.Data)
	})

	if err != nil {
		resp.Errors = append(resp.Errors, err)
	}

	return resp
}

// collectBucketValues recursively walks nested buckets and captures leaf values.
func collectBucketValues(bucket *bolt.Bucket, prefix string, data map[string][]byte) error {
	return bucket.ForEach(func(k []byte, v []byte) error {
		if nestedBucket := bucket.Bucket(k); nestedBucket != nil {
			nestedPrefix := string(k)
			if prefix != "" {
				nestedPrefix = prefix + "/" + nestedPrefix
			}
			return collectBucketValues(nestedBucket, nestedPrefix, data)
		}

		dataKey := string(k)
		if prefix != "" {
			dataKey = prefix + "/" + dataKey
		}
		data[dataKey] = v
		return nil
	})
}
