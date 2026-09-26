package boltdb

import (
	"bytes"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
	bolt "go.etcd.io/bbolt"
)

// archiveTestBackend creates isolated persistent storage for archive tests.
func archiveTestBackend(t *testing.T) *BoltDBBackend {
	t.Helper()
	b := NewBoltDbBackend(&BoltDBBackendOptions{Path: filepath.Join(t.TempDir(), "data.db")})
	t.Cleanup(func() { _ = b.Close() })
	return b
}

// seedArchiveBackend writes records directly to verify exact byte and bucket preservation.
func seedArchiveBackend(t *testing.T, b *BoltDBBackend, records map[string]map[string]string) {
	t.Helper()
	err := b.db.Update(func(tx *bolt.Tx) error {
		for ns, values := range records {
			bucket, err := tx.Bucket([]byte(DataStoreBucket)).CreateBucketIfNotExists([]byte(ns))
			if err != nil {
				return err
			}
			for key, value := range values {
				if err := bucket.Put([]byte(key), []byte(value)); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// TestArchiveRoundTrip preserves all buckets, metadata, binary values, sequences and empty buckets.
func TestArchiveRoundTrip(t *testing.T) {
	source, target := archiveTestBackend(t), archiveTestBackend(t)
	seedArchiveBackend(t, source, map[string]map[string]string{"empty": {}, "default": {"a": "first"}, "other": {"a": "second"}, "cartographer-admin": {"template/test": "template"}})
	err := source.db.Update(func(tx *bolt.Tx) error {
		extra, err := tx.CreateBucket([]byte{0xff, 0x00})
		if err != nil {
			return err
		}
		if err := extra.SetSequence(42); err != nil {
			return err
		}
		nested, err := extra.CreateBucket([]byte("nested"))
		if err != nil {
			return err
		}
		return nested.Put([]byte{0xfe}, []byte{0, 0xff, 3})
	})
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := source.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	var archive bytes.Buffer
	if err := backend.WriteArchive(&archive, snapshot); err != nil {
		t.Fatal(err)
	}
	decoded, err := backend.ReadArchive(&archive)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := target.Restore(decoded, "replace", nil); err != nil {
		t.Fatal(err)
	}
	got, err := target.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(snapshot, got) {
		t.Fatalf("round trip changed database: want %#v, got %#v", snapshot, got)
	}
}

// TestArchiveModes verifies namespace-scoped conflicts and replacement of absent records.
func TestArchiveModes(t *testing.T) {
	for _, mode := range []string{"replace", "merge"} {
		t.Run(mode, func(t *testing.T) {
			source, target := archiveTestBackend(t), archiveTestBackend(t)
			seedArchiveBackend(t, source, map[string]map[string]string{"default": {"b": "archived", "c": "new"}, "other": {"b": "other namespace"}, "cartographer-admin": {"template/test": "archived template"}})
			seedArchiveBackend(t, target, map[string]map[string]string{"default": {"a": "keep", "b": "current"}, "cartographer-admin": {"template/test": "current template"}, "extra": {}})
			snapshot, _ := source.Snapshot()
			result, err := target.Restore(snapshot, mode, nil)
			if err != nil {
				t.Fatal(err)
			}
			err = target.db.View(func(tx *bolt.Tx) error {
				data := tx.Bucket([]byte(DataStoreBucket))
				ns := data.Bucket([]byte("default"))
				b, template := "archived", "archived template"
				if mode == "merge" {
					b, template = "current", "current template"
				}
				if string(ns.Get([]byte("b"))) != b || string(data.Bucket([]byte("cartographer-admin")).Get([]byte("template/test"))) != template {
					t.Fatal("conflict policy violated")
				}
				if (ns.Get([]byte("a")) != nil) != (mode == "merge") || (data.Bucket([]byte("extra")) != nil) != (mode == "merge") {
					t.Fatal("unexpected retention of database-only records")
				}
				if string(ns.Get([]byte("c"))) != "new" || string(data.Bucket([]byte("other")).Get([]byte("b"))) != "other namespace" {
					t.Fatal("missing imported record")
				}
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			if mode == "merge" && (result.Added != 2 || result.Skipped != 2) {
				t.Fatalf("unexpected counts: %+v", result)
			}
			if mode == "replace" && (result.Added != 4 || result.Skipped != 0) {
				t.Fatalf("unexpected counts: %+v", result)
			}
		})
	}
}

// TestArchiveRollback ensures derived-state failures and invalid snapshots do not mutate storage.
func TestArchiveRollback(t *testing.T) {
	b, source := archiveTestBackend(t), archiveTestBackend(t)
	seedArchiveBackend(t, b, map[string]map[string]string{"default": {"keep": "current"}})
	seedArchiveBackend(t, source, map[string]map[string]string{"default": {"new": "new"}})
	before, _ := b.Snapshot()
	incoming, _ := source.Snapshot()
	failure := errors.New("index build failed")
	for _, mode := range []string{"replace", "merge"} {
		_, err := b.Restore(incoming, mode, func(*backend.Snapshot) error { return failure })
		if !errors.Is(err, failure) {
			t.Fatalf("expected rollback error, got %v", err)
		}
		after, _ := b.Snapshot()
		if !reflect.DeepEqual(before, after) {
			t.Fatal("failed restore modified database")
		}
	}
	for _, invalid := range []*backend.Snapshot{{}, {Buckets: []backend.ArchiveBucket{{Name: []byte("duplicate")}, {Name: []byte("duplicate")}}}} {
		if _, err := b.Restore(invalid, "replace", nil); !errors.Is(err, backend.ErrInvalidArchive) {
			t.Fatalf("expected invalid archive, got %v", err)
		}
	}
	after, _ := b.Snapshot()
	if !reflect.DeepEqual(before, after) {
		t.Fatal("invalid restore modified database")
	}
}
