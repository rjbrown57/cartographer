package boltdb

import (
	"log"
	"time"

	bolt "go.etcd.io/bbolt"
)

const (
	SchemaVersion   = "0.0.0"
	MetaBucket      = "meta"
	DataStoreBucket = "data_store"
)

type BoltDBBackend struct {
	db   *bolt.DB
	path string
}

type BoltDBBackendOptions struct {
	Path string
}

func NewBoltDbBackend(options *BoltDBBackendOptions) *BoltDBBackend {
	db, err := bolt.Open(options.Path, 0600, nil)
	if err != nil {
		log.Fatalf("Failed to open BoltDB backend: %v", err)
	}

	backend := &BoltDBBackend{
		db:   db,
		path: options.Path,
	}

	err = backend.initialize()
	if err != nil {
		log.Fatalf("Failed to initialize BoltDB backend: %v", err)
	}

	return backend
}

func (b *BoltDBBackend) initialize() error {
	// Create the data_store bucket
	err := b.db.Update(func(tx *bolt.Tx) error {
		return createBucketFunc(DataStoreBucket)(tx)
	})
	if err != nil {
		return err
	}

	// Create the meta bucket
	err = b.db.Update(func(tx *bolt.Tx) error {
		return createBucketFunc(MetaBucket)(tx)
	})
	if err != nil {
		return err
	}

	// Populate the meta bucket with the initial schema
	err = b.db.Update(func(tx *bolt.Tx) error {
		metaBucket := getBucketFunc(MetaBucket)(tx)
		metaBucket.Put([]byte("schema"), []byte(SchemaVersion))
		// if the createdDate is not set, set it to the current time
		if createdDate := metaBucket.Get([]byte("createdDate")); createdDate == nil {
			metaBucket.Put([]byte("createdDate"), []byte(time.Now().Format(time.RFC3339)))
		}

		metaBucket.Put([]byte("updatedDate"), []byte(time.Now().Format(time.RFC3339)))
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func createBucketFunc(bucketName string) func(tx *bolt.Tx) error {
	return func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucketName))
		return err
	}
}

func getBucketFunc(bucketName string) func(tx *bolt.Tx) *bolt.Bucket {
	return func(tx *bolt.Tx) *bolt.Bucket {
		return tx.Bucket([]byte(bucketName))
	}
}
