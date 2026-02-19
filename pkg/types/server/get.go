package server

import (
	"context"
	"errors"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

func getDataset(c *CartographerServer, in *proto.CartographerGetRequest) ([]*proto.Link, error) {

	links := make([]*proto.Link, 0)
	var err error

	switch {
	// if there are no tags or terms, send all links
	case len(in.Request.GetTags()) == 0 && len(in.Request.GetTerms()) == 0:
		c.mu.RLock()
		for _, link := range c.cache {
			links = append(links, link)
		}
		c.mu.RUnlock()
	case len(in.Request.GetTags()) > 0 && len(in.Request.GetTerms()) == 0:
		// if there are tags but no terms, handle via the tag cache
		links, err = c.Search(in, &SearchOptions{Limit: SearchLimitTags})
		if err != nil {
			return nil, err
		}
	// otherwise search the index for the links
	default:
		links, err = c.Search(in, &SearchOptions{Limit: SearchLimitAll})
		if err != nil {
			return nil, err
		}
	}

	return links, nil
}

func (c *CartographerServer) Get(_ context.Context, in *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {

	// record the duration of the get operation
	defer metrics.RecordOperationDuration("get")()

	r := &proto.CartographerGetResponse{
		Response: &proto.CartographerResponse{
			Namespace: in.Request.GetNamespace(),
		},
	}

	log.Tracef("Get Request: %v", in.Type)

	switch in.Type {
	// RequestType_REQUEST_TYPE_DATA returns a list of links
	// It can be filtered tags or terms. tags can be supplied collectively as a group, or by individual tag
	case proto.RequestType_REQUEST_TYPE_DATA:

		var err error

		r.Response.Links, err = getDataset(c, in)
		if err != nil {
			return nil, err
		}

	// RequestType_REQUEST_TYPE_GROUP returns a list of groups from the cache
	case proto.RequestType_REQUEST_TYPE_GROUP:
		c.mu.RLock()
		for _, group := range c.groupCache {
			r.Response.Groups = append(r.Response.Groups, group.Name)
		}
		c.mu.RUnlock()
	// RequestType_REQUEST_TYPE_TAG returns a list of tags from the cache
	case proto.RequestType_REQUEST_TYPE_TAG:
		c.mu.RLock()
		for tag := range c.tagCache {
			r.Response.Tags = append(r.Response.Tags, tag)
		}
		c.mu.RUnlock()

	case proto.RequestType_REQUEST_TYPE_UNSPECIFIED:
		log.Infof("unknown RequestType")
		return nil, errors.New("unknown RequestType")
	}

	return r, nil
}
