package server

import (
	"context"
	"errors"
	"slices"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

// getDataset returns namespace-scoped links for data requests, using cache-only reads when possible.
func getDataset(c *CartographerServer, in *proto.CartographerGetRequest, ns string) ([]*proto.Link, error) {

	links := make([]*proto.Link, 0)
	var err error

	switch {
	// if there are no tags or terms, send all links for the NS
	case len(in.Request.GetTags()) == 0 && len(in.Request.GetTerms()) == 0:
		c.mu.RLock()
		links = c.nsCache.GetLinks(ns)
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

// Get handles read requests and serves all results from namespace-scoped caches.
func (c *CartographerServer) Get(_ context.Context, in *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {

	// record the duration of the get operation
	defer metrics.RecordOperationDuration("get")()

	// enforce default ns behavior
	ns, err := proto.GetNamespace(in.Request.GetNamespace())
	if err != nil {
		return nil, errors.New("invalid namespace supplied")
	}

	in.Request.Namespace = ns

	r := &proto.CartographerGetResponse{
		Response: &proto.CartographerResponse{
			Namespace: ns,
		},
	}

	log.Tracef("Get Request: %v", in.Type)

	switch in.Type {
	// RequestType_REQUEST_TYPE_DATA returns a list of links
	// It can be filtered tags or terms. tags can be supplied collectively as a group, or by individual tag
	case proto.RequestType_REQUEST_TYPE_DATA:

		var err error

		r.Response.Links, err = getDataset(c, in, ns)
		if err != nil {
			return nil, err
		}

	// RequestType_REQUEST_TYPE_GROUP returns a list of groups from the cache
	case proto.RequestType_REQUEST_TYPE_GROUP:
		c.mu.RLock()
		r.Response.Groups = c.nsCache.GetGroups(ns)
		c.mu.RUnlock()
	// RequestType_REQUEST_TYPE_TAG returns a list of tags from the cache
	case proto.RequestType_REQUEST_TYPE_TAG:
		c.mu.RLock()
		r.Response.Tags = c.nsCache.GetTags(ns)
		c.mu.RUnlock()
	// RequestType_REQUEST_TYPE_NAMESPACE returns a list of namespaces from the cache.
	case proto.RequestType_REQUEST_TYPE_NAMESPACE:
		c.mu.RLock()
		r.Response.Msg = c.nsCache.GetNamespaces()
		c.mu.RUnlock()
		slices.Sort(r.Response.Msg)

	case proto.RequestType_REQUEST_TYPE_UNSPECIFIED:
		log.Infof("unknown RequestType")
		return nil, errors.New("unknown RequestType")
	}

	return r, nil
}
