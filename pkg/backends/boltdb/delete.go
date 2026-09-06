package boltdb

import (
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	bolt "go.etcd.io/bbolt"
)

func (b *BoltDBBackend) Delete(r *proto.CartographerDeleteRequest) *proto.CartographerDeleteResponse {
	log.Debugf("Removing data from BoltDB backend: %+v", r)

	resp := &proto.CartographerDeleteResponse{}
	stagedIDs := make([]string, 0, len(r.GetIds()))
	var stagedErrors []string
	// Start a transaction to add the data to the database
	err := b.db.Update(func(tx *bolt.Tx) error {
		// get the data_store bucket
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)
		namespaceBucket := dataStoreBucket.Bucket([]byte(r.Namespace))

		// delete the data to the database
		for _, id := range r.Ids {
			if namespaceBucket == nil {
				stagedErrors = append(stagedErrors, fmt.Sprintf("id not found: %s", id))
				continue
			}

			// check if the id exists in the database
			if namespaceBucket.Get([]byte(id)) == nil {
				stagedErrors = append(stagedErrors, fmt.Sprintf("id not found: %s", id))
				continue
			}

			err := namespaceBucket.Delete([]byte(id))
			if err != nil {
				return fmt.Errorf("error deleting data from BoltDB: %w", err)
			}

			stagedIDs = append(stagedIDs, id)
		}

		if namespaceBucket != nil {
			cursor := namespaceBucket.Cursor()
			key, _ := cursor.First()
			if key == nil {
				if err := dataStoreBucket.DeleteBucket([]byte(r.Namespace)); err != nil {
					return fmt.Errorf("error deleting empty namespace bucket from BoltDB: %w", err)
				}
			}
		}

		return nil
	})

	if err != nil {
		log.Errorf("Error deleting data from BoltDB: %s", err)
		resp.Errors = append(resp.Errors, fmt.Sprintf("error deleting data from BoltDB: %s", err))
		return resp
	}

	// Only acknowledge IDs and per-ID misses after BoltDB commits the transaction.
	resp.Ids = stagedIDs
	resp.Errors = stagedErrors

	return resp
}
