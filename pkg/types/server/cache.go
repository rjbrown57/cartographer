package server

import (
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// AddToCache adds a link or group to the namespace cache and updates supporting indexes.
func (c *CartographerServer) AddToCache(v any, ns string) {
	c.mu.Lock()
	switch v := v.(type) {
	case *proto.Link:
		log.Debugf("Adding link %s to cache", v.GetKey())
		c.nsCache.AddToCache(ns, v)

		// Add the link to bleve for search resolution.
		docID := makeBleveDocID(ns, v.GetKey())
		log.Debugf("Indexing link %s", docID)
		err := c.bleve.Index(docID, v)
		if err != nil {
			log.Errorf("Error indexing link %s: %v", docID, err)
		}

		metrics.IncrementObjectCount("searchIndexCount", 1)

	case *proto.Group:
		log.Debugf("Adding group %s to cache", v.Name)
		c.nsCache.AddToCache(ns, v)
	}
	c.mu.Unlock()
}

// DeleteFromCache deletes links from the namespace cache and removes them from search indexes.
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
			metrics.DecrementObjectCount("searchIndexCount", 1)
		}
	}
	c.mu.Unlock()
}
