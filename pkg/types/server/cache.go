package server

import (
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func (c *CartographerServer) AddToCache(v interface{}) {
	switch v.(type) {
	case *proto.Link:
		l := v.(*proto.Link)
		log.Printf("Adding link %s to cache", l.Url)
		c.cache[l.Url] = v
		for _, tag := range l.Tags {
			c.tagCache[tag] = proto.NewProtoTag(tag, "")
		}
	case *proto.Group:
		log.Printf("Adding group %s to cache", v.(*proto.Group).Name)
		g := v.(*proto.Group)
		c.cache[g.Name] = g
		c.groupCache[g.Name] = g
	}
}

func (c *CartographerServer) DeleteFromCache(key ...string) {
	log.Printf("Deleting %s from cache", key)
	for _, k := range key {
		delete(c.cache, k)
	}
}
