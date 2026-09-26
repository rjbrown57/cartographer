package boltdb

import (
	"bytes"
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

// Snapshot copies all buckets in one read transaction so the archive is consistent.
func (b *BoltDBBackend) Snapshot() (*backend.Snapshot, error) {
	var snapshot *backend.Snapshot
	err := b.db.View(func(tx *bolt.Tx) error {
		var err error
		snapshot, err = snapshotTx(tx)
		return err
	})
	return snapshot, err
}

// snapshotTx copies database-owned byte slices before their transaction closes.
func snapshotTx(tx *bolt.Tx) (*backend.Snapshot, error) {
	snapshot := &backend.Snapshot{}
	err := tx.ForEach(func(name []byte, bucket *bolt.Bucket) error {
		copied, err := snapshotBucket(name, bucket)
		snapshot.Buckets = append(snapshot.Buckets, copied)
		return err
	})
	return snapshot, err
}

// snapshotBucket recursively preserves raw values, empty buckets and sequences.
func snapshotBucket(name []byte, bucket *bolt.Bucket) (backend.ArchiveBucket, error) {
	result := backend.ArchiveBucket{Name: bytes.Clone(name), Sequence: bucket.Sequence()}
	err := bucket.ForEach(func(k, v []byte) error {
		if child := bucket.Bucket(k); child != nil {
			copied, err := snapshotBucket(k, child)
			if err != nil {
				return err
			}
			result.Buckets = append(result.Buckets, copied)
		} else {
			result.Values = append(result.Values, backend.ArchiveValue{Key: bytes.Clone(k), Value: bytes.Clone(v)})
		}
		return nil
	})
	return result, err
}

// validateSnapshot rejects incompatible schemas and ambiguous or invalid bucket trees.
func validateSnapshot(snapshot *backend.Snapshot) error {
	if snapshot == nil {
		return fmt.Errorf("%w: missing snapshot", backend.ErrInvalidArchive)
	}
	root := backend.ArchiveBucket{Buckets: snapshot.Buckets}
	if err := validateBucket(root, 0); err != nil {
		return err
	}
	var dataFound, schemaFound bool
	for _, bucket := range snapshot.Buckets {
		if string(bucket.Name) == DataStoreBucket {
			dataFound = true
		}
		if string(bucket.Name) == MetaBucket {
			for _, value := range bucket.Values {
				if string(value.Key) == "schema" && string(value.Value) == SchemaVersion {
					schemaFound = true
				}
			}
		}
	}
	if !dataFound || !schemaFound {
		return fmt.Errorf("%w: missing data_store or incompatible schema", backend.ErrInvalidArchive)
	}
	return nil
}

// validateBucket bounds nesting and rejects duplicate keys, including value/bucket collisions.
func validateBucket(bucket backend.ArchiveBucket, depth int) error {
	if depth > 64 {
		return fmt.Errorf("%w: excessive bucket nesting", backend.ErrInvalidArchive)
	}
	seen := map[string]bool{}
	check := func(key []byte) error {
		if len(key) == 0 || len(key) > bolt.MaxKeySize || seen[string(key)] {
			return fmt.Errorf("%w: empty, oversized or duplicate key", backend.ErrInvalidArchive)
		}
		seen[string(key)] = true
		return nil
	}
	for _, value := range bucket.Values {
		if err := check(value.Key); err != nil {
			return err
		}
	}
	for _, child := range bucket.Buckets {
		if err := check(child.Name); err != nil {
			return err
		}
		if err := validateBucket(child, depth+1); err != nil {
			return err
		}
	}
	return nil
}

// Restore applies replace or merge in one transaction, rolling back if preparation fails.
func (b *BoltDBBackend) Restore(snapshot *backend.Snapshot, mode string, prepare func(*backend.Snapshot) error) (*backend.ImportResult, error) {
	if mode != "replace" && mode != "merge" {
		return nil, fmt.Errorf("%w: mode must be replace or merge", backend.ErrInvalidArchive)
	}
	if err := validateSnapshot(snapshot); err != nil {
		return nil, err
	}
	result := &backend.ImportResult{Mode: mode}
	err := b.db.Update(func(tx *bolt.Tx) error {
		if mode == "replace" {
			var names [][]byte
			if err := tx.ForEach(func(name []byte, _ *bolt.Bucket) error {
				names = append(names, bytes.Clone(name))
				return nil
			}); err != nil {
				return err
			}
			for _, name := range names {
				if err := tx.DeleteBucket(name); err != nil {
					return err
				}
			}
		}
		for _, archived := range snapshot.Buckets {
			exists := tx.Bucket(archived.Name) != nil
			bucket, err := tx.CreateBucketIfNotExists(archived.Name)
			if err != nil {
				return err
			}
			if err := restoreBucket(bucket, archived, mode == "merge" && exists, string(archived.Name) == DataStoreBucket, result); err != nil {
				return err
			}
		}
		if prepare != nil {
			staged, err := snapshotTx(tx)
			if err != nil {
				return err
			}
			return prepare(staged)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// restoreBucket keeps existing values and sequences during merge; counts cover data_store records.
func restoreBucket(bucket *bolt.Bucket, archived backend.ArchiveBucket, keep, count bool, result *backend.ImportResult) error {
	if !keep {
		if err := bucket.SetSequence(archived.Sequence); err != nil {
			return err
		}
	}
	for _, value := range archived.Values {
		if keep && (bucket.Get(value.Key) != nil || bucket.Bucket(value.Key) != nil) {
			if count {
				result.Skipped++
			}
			continue
		}
		if err := bucket.Put(value.Key, value.Value); err != nil {
			return err
		}
		if count {
			result.Added++
		}
	}
	for _, child := range archived.Buckets {
		if keep && bucket.Get(child.Name) != nil {
			return fmt.Errorf("%w: bucket/value conflict", backend.ErrInvalidArchive)
		}
		exists := bucket.Bucket(child.Name) != nil
		nested, err := bucket.CreateBucketIfNotExists(child.Name)
		if err != nil {
			return err
		}
		if err := restoreBucket(nested, child, keep && exists, count, result); err != nil {
			return err
		}
	}
	return nil
}
