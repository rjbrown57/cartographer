package server

import (
	"sync"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

type NSCache map[string]*CartoNamespace

// CartoNamespaces are used to organize caching information
type CartoNamespace struct {
	name      string
	NoteCache map[string]*proto.Note
	tagCache  map[string][]*proto.Note
	mu        sync.RWMutex
}

func NewCartoNamespace(name string) *CartoNamespace {
	return &CartoNamespace{
		name:      name,
		NoteCache: make(map[string]*proto.Note),
		tagCache:  make(map[string][]*proto.Note),
		mu:        sync.RWMutex{},
	}
}

// GetNotes returns a namespace-scoped snapshot of cached notes for safe iteration without holding locks.
func (n *NSCache) GetNotes(ns string) []*proto.Note {
	cn, ok := (*n)[ns]
	if !ok {
		return nil
	}

	cn.mu.RLock()
	notes := make([]*proto.Note, 0, len(cn.NoteCache))
	for _, note := range cn.NoteCache {
		notes = append(notes, note)
	}
	cn.mu.RUnlock()

	return notes
}

// GetNotesByKey returns namespace-scoped notes for the supplied cache keys.
func (n *NSCache) GetNotesByKey(ns string, keys []string) []*proto.Note {
	cn, ok := (*n)[ns]
	if !ok {
		return nil
	}

	cn.mu.RLock()
	notes := make([]*proto.Note, 0, len(keys))
	for _, key := range keys {
		if note, ok := cn.NoteCache[key]; ok {
			notes = append(notes, note)
		}
	}
	cn.mu.RUnlock()

	return notes
}

// GetTags returns a namespace-scoped snapshot of tag names for safe iteration without holding locks.
func (n *NSCache) GetTags(ns string) []string {
	cn, ok := (*n)[ns]
	if !ok {
		return nil
	}

	cn.mu.RLock()
	tags := make([]string, 0, len(cn.tagCache))
	for tag := range cn.tagCache {
		tags = append(tags, tag)
	}
	cn.mu.RUnlock()

	return tags
}

// GetNamespaces returns a snapshot of currently allocated namespace keys in the cache.
func (n *NSCache) GetNamespaces() []string {
	namespaces := make([]string, 0, len(*n))
	for ns := range *n {
		namespaces = append(namespaces, ns)
	}

	return namespaces
}

// AddToCache adds notes to the appropriate namespace cache while maintaining tag lookup state.
func (n *NSCache) AddToCache(ns string, v any) {
	// Resolve the namespace bucket first so all cache updates for this call
	// operate against a single namespace-scoped cache container.
	cn, ok := (*n)[ns]
	if !ok {
		// Namespaces are created lazily to avoid allocating cache maps for
		// namespaces that never receive data.
		cn = NewCartoNamespace(ns)
		(*n)[ns] = cn
	}

	// Lock the namespace-level cache so note/tag maps remain internally
	// consistent while this object is inserted.
	cn.mu.Lock()
	switch v := v.(type) {
	case *proto.Note:
		if existing, ok := cn.NoteCache[v.GetKey()]; ok {
			cn.removeNoteFromTagCache(existing)
		}

		// Primary note cache is keyed by note key for direct lookup.
		cn.NoteCache[v.GetKey()] = v

		// Secondary tag index points each tag to all notes carrying that tag.
		// This keeps tag filtering fast without scanning all cached notes.
		for _, tag := range v.Tags {
			// Allocate the slice once per new tag in this namespace.
			if _, ok := cn.tagCache[tag]; !ok {
				cn.tagCache[tag] = make([]*proto.Note, 0)
			}

			// Append the note to the tag index for fan-out retrieval.
			cn.tagCache[tag] = append(cn.tagCache[tag], v)
		}
	}

	cn.mu.Unlock()
}

// removeNoteFromTagCache removes the supplied note from each of its tag buckets.
func (n *CartoNamespace) removeNoteFromTagCache(note *proto.Note) {
	for _, tag := range note.Tags {
		notes, ok := n.tagCache[tag]
		if !ok {
			continue
		}

		out := notes[:0]
		for _, cachedNote := range notes {
			if cachedNote.GetKey() != note.GetKey() {
				out = append(out, cachedNote)
			}
		}

		if len(out) == 0 {
			delete(n.tagCache, tag)
			continue
		}
		n.tagCache[tag] = out
	}
}

// DeleteFromCache removes a note key from a namespace cache and updates tag indexes in-place.
func (n *NSCache) DeleteFromCache(ns string, key string) {
	// Fast-path: if the namespace cache has not been created there is nothing to delete.
	cn, ok := (*n)[ns]
	if !ok {
		return
	}

	// Lock the namespace once so the primary cache and tag index stay consistent during deletion.
	cn.mu.Lock()
	// Resolve the note first so we can clean up tag reverse indexes before dropping the primary entry.
	note, ok := cn.NoteCache[key]
	if !ok {
		cn.mu.Unlock()
		return
	}

	delete(cn.NoteCache, key)

	cn.removeNoteFromTagCache(note)
	cn.mu.Unlock()
}
