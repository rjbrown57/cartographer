package server

import (
	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) AddToCache(v any) {
	c.mu.Lock()
	switch v := v.(type) {
	case *proto.Link:
		log.Debugf("Adding link %s to cache", v.GetKey())
		c.cache[v.GetKey()] = v
		for _, tag := range v.Tags {
			// initialize the tag cache if it doesn't exist
			if _, ok := c.tagCache[tag]; !ok {
				c.tagCache[tag] = make([]*proto.Link, 0)
			}
			c.tagCache[tag] = append(c.tagCache[tag], v)
		}

		// Add link to bleve
		log.Debugf("Indexing link %s", v.GetKey())
		err := c.bleve.Index(v.GetKey(), v)
		if err != nil {
			log.Errorf("Error indexing link %s: %v", v.GetKey(), err)
		}

	case *proto.Group:
		log.Debugf("Adding group %s to cache", v.Name)
		c.groupCache[v.Name] = v
	}
	c.mu.Unlock()
}

func (c *CartographerServer) DeleteFromCache(key ...string) {
	c.mu.Lock()
	log.Debugf("Deleting %s from cache", key)
	for _, k := range key {
		delete(c.cache, k)
	}
	c.mu.Unlock()
}
