package server

import (
	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) AddToCache(v interface{}) {
	c.mu.Lock()
	switch v.(type) {
	case *proto.Link:
		l := v.(*proto.Link)
		log.Debugf("Adding link %s to cache", l.Url)
		c.cache[l.Url] = v
		for _, tag := range l.Tags {
			c.tagCache[tag] = proto.NewProtoTag(tag, "")
		}
	case *proto.Group:
		log.Debugf("Adding group %s to cache", v.(*proto.Group).Name)
		g := v.(*proto.Group)
		c.cache[g.Name] = g
		c.groupCache[g.Name] = g
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
