package server

import (
	"fmt"
	"io"

	"github.com/blevesearch/bleve"
	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

// Export writes a consistent database snapshot without holding a transaction during download.
func (c *CartographerServer) Export(w io.Writer) error {
	store, ok := c.Backend.(backend.ArchiveBackend)
	if !ok {
		return fmt.Errorf("backend does not support archives")
	}
	snapshot, err := store.Snapshot()
	if err != nil {
		return err
	}
	return backend.WriteArchive(w, snapshot)
}

// Import restores persistent and derived state together, bypassing add-time metadata changes.
func (c *CartographerServer) Import(r io.Reader, mode string) (*backend.ImportResult, error) {
	if mode != "replace" && mode != "merge" {
		return nil, fmt.Errorf("%w: mode must be replace or merge", backend.ErrInvalidArchive)
	}
	snapshot, err := backend.ReadArchive(r)
	if err != nil {
		return nil, err
	}
	store, ok := c.Backend.(backend.ArchiveBackend)
	if !ok {
		return nil, fmt.Errorf("backend does not support archives")
	}
	// Validate all incoming notes, even those a merge would skip.
	if err := visitArchiveNotes(snapshot, nil); err != nil {
		return nil, err
	}
	c.archiveMu.Lock()
	defer c.archiveMu.Unlock()
	c.mu.Lock()
	defer c.mu.Unlock()
	var stagedIndex bleve.Index
	stagedCache := make(NSCache)
	result, err := store.Restore(snapshot, mode, func(staged *backend.Snapshot) error {
		var err error
		stagedIndex, err = bleve.NewMemOnly(bleve.NewIndexMapping())
		if err != nil {
			return err
		}
		return visitArchiveNotes(staged, func(namespace string, note *proto.Note) error {
			if _, ok := stagedCache[namespace]; !ok {
				stagedCache[namespace] = NewCartoNamespace(namespace)
			}
			if note == nil {
				return nil
			}
			stagedCache.AddToCache(namespace, note)
			return stagedIndex.Index(makeBleveDocID(namespace, note.GetKey()), note)
		})
	})
	if err != nil {
		if stagedIndex != nil {
			_ = stagedIndex.Close()
		}
		return nil, err
	}
	oldIndex := c.bleve
	c.nsCache, c.bleve = stagedCache, stagedIndex
	counts := make(map[string]int, len(stagedCache))
	for ns, cached := range stagedCache {
		counts[ns] = len(cached.NoteCache)
	}
	metrics.Metrics().SetObjectCounts(counts)
	if oldIndex != nil {
		if err := oldIndex.Close(); err != nil {
			log.Errorf("Close previous search index: %v", err)
		}
	}
	if c.Notifier != nil {
		go c.Notifier.Publish(result)
	}
	return result, nil
}

// visitArchiveNotes validates stored note keys and visits empty namespaces explicitly.
func visitArchiveNotes(snapshot *backend.Snapshot, visit func(string, *proto.Note) error) error {
	for _, bucket := range snapshot.Buckets {
		if string(bucket.Name) != "data_store" {
			continue
		}
		if len(bucket.Values) != 0 {
			return fmt.Errorf("%w: data_store must contain namespaces", backend.ErrInvalidArchive)
		}
		for _, namespace := range bucket.Buckets {
			ns := string(namespace.Name)
			normalized, err := proto.GetNamespace(ns)
			if err != nil || normalized != ns || len(namespace.Buckets) != 0 {
				return fmt.Errorf("%w: invalid namespace", backend.ErrInvalidArchive)
			}
			if visit != nil {
				if err := visit(ns, nil); err != nil {
					return err
				}
			}
			for _, value := range namespace.Values {
				note, err := decodeBackendNote(value.Value)
				if err != nil || note.GetKey() == "" || note.GetKey() != string(value.Key) {
					return fmt.Errorf("%w: invalid note in namespace %q", backend.ErrInvalidArchive, ns)
				}
				if visit != nil {
					if err := visit(ns, note); err != nil {
						return err
					}
				}
			}
		}
	}
	return nil
}
