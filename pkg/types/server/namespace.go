package server

import (
	"sync"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

type NSCache map[string]*CartoNamespace

// CartoNamespaces are used to organize caching information
type CartoNamespace struct {
	name      string
	LinkCache map[string]*proto.Link
	tagCache  map[string][]*proto.Link
	mu        sync.RWMutex
}

func NewCartoNamespace(name string) *CartoNamespace {
	return &CartoNamespace{
		name:      name,
		LinkCache: make(map[string]*proto.Link),
		tagCache:  make(map[string][]*proto.Link),
		mu:        sync.RWMutex{},
	}
}

// GetLinks returns a namespace-scoped snapshot of cached links for safe iteration without holding locks.
func (n *NSCache) GetLinks(ns string) []*proto.Link {
	cn, ok := (*n)[ns]
	if !ok {
		return nil
	}

	cn.mu.RLock()
	links := make([]*proto.Link, 0, len(cn.LinkCache))
	for _, link := range cn.LinkCache {
		links = append(links, link)
	}
	cn.mu.RUnlock()

	return links
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

// AddToCache adds links to the appropriate namespace cache while maintaining tag lookup state.
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

	// Lock the namespace-level cache so link/tag maps remain internally
	// consistent while this object is inserted.
	cn.mu.Lock()
	switch v := v.(type) {
	case *proto.Link:
		// Primary link cache is keyed by link key for direct lookup.
		cn.LinkCache[v.GetKey()] = v

		// Secondary tag index points each tag to all links carrying that tag.
		// This keeps tag filtering fast without scanning all cached links.
		for _, tag := range v.Tags {
			// Allocate the slice once per new tag in this namespace.
			if _, ok := cn.tagCache[tag]; !ok {
				cn.tagCache[tag] = make([]*proto.Link, 0)
			}

			// Append the link to the tag index for fan-out retrieval.
			cn.tagCache[tag] = append(cn.tagCache[tag], v)
		}
	}

	cn.mu.Unlock()
}

// DeleteFromCache removes a link key from a namespace cache and updates tag indexes in-place.
func (n *NSCache) DeleteFromCache(ns string, key string) {
	// Fast-path: if the namespace cache has not been created there is nothing to delete.
	cn, ok := (*n)[ns]
	if !ok {
		return
	}

	// Lock the namespace once so the primary cache and tag index stay consistent during deletion.
	cn.mu.Lock()
	// Resolve the link first so we can clean up tag reverse indexes before dropping the primary entry.
	link, ok := cn.LinkCache[key]
	if !ok {
		cn.mu.Unlock()
		return
	}

	delete(cn.LinkCache, key)

	// Remove the link from each tag bucket using in-place compaction to avoid extra allocations.
	for _, tag := range link.Tags {
		links, ok := cn.tagCache[tag]
		if !ok {
			continue
		}

		out := links[:0]
		for _, l := range links {
			if l.GetKey() != key {
				out = append(out, l)
			}
		}

		if len(out) == 0 {
			delete(cn.tagCache, tag)
			continue
		}
		cn.tagCache[tag] = out
	}
	cn.mu.Unlock()
}
