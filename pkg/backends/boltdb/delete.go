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
	// Start a transaction to add the data to the database
	err := b.db.Update(func(tx *bolt.Tx) error {
		// get the data_store bucket
		dataStoreBucket := getBucketFunc(DataStoreBucket)(tx)

		// delete the data to the database
		for _, id := range r.Ids {
			// check if the id exists in the database
			if dataStoreBucket.Get([]byte(id)) == nil {
				resp.Errors = append(resp.Errors, fmt.Sprintf("id not found: %s", id))
				continue
			}

			err := dataStoreBucket.Delete([]byte(id))
			if err != nil {
				log.Errorf("Error deleting data from BoltDB: %s", err)
				resp.Errors = append(resp.Errors, fmt.Sprintf("error deleting data from BoltDB: %s", err))
				continue
			}

			resp.Ids = append(resp.Ids, id)
		}

		return nil
	})

	if err != nil {
		log.Errorf("Error deleting data from BoltDB: %s", err)
		resp.Errors = append(resp.Errors, fmt.Sprintf("error deleting data from BoltDB: %s", err))
	}

	return resp
}
