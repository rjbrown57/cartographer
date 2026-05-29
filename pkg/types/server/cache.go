package server

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// AddToCache adds a note to the namespace cache and updates supporting indexes.
func (c *CartographerServer) AddToCache(v any, ns string) {
	c.mu.Lock()
	switch v := v.(type) {
	case *proto.Note:
		log.Debugf("Adding note %s to cache", v.GetKey())
		c.nsCache.AddToCache(ns, v)

		// Add the note to bleve for search resolution.
		docID := makeBleveDocID(ns, v.GetKey())
		log.Debugf("Indexing note %s", docID)
		err := c.bleve.Index(docID, v)
		if err != nil {
			log.Errorf("Error indexing note %s: %v", docID, err)
		}

		metrics.Metrics().IncrementObjectCount("searchIndexCount", ns, 1)
	}
	c.mu.Unlock()
}

// DeleteFromCache deletes notes from the namespace cache and removes them from search indexes.
func (c *CartographerServer) DeleteFromCache(ns string, key ...string) {
	c.mu.Lock()
	log.Debugf("Deleting %s from cache", key)

	for _, k := range key {
		c.nsCache.DeleteFromCache(ns, k)

		docID := makeBleveDocID(ns, k)
		err := c.bleve.Delete(docID)
		if err != nil {
			log.Errorf("Error deleting %s from bleve: %v", docID, err)
		} else {
			metrics.Metrics().DecrementObjectCount("searchIndexCount", ns, 1)
		}
	}
	c.mu.Unlock()
}
