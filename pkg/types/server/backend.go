package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
	"github.com/rjbrown57/cartographer/pkg/utils"
	"google.golang.org/grpc"
)

func (c *CartographerServer) PrepFilters(in *proto.CartographerGetRequest) (map[string]struct{}, error) {
	tagFilters := make(map[string]struct{})

	for _, tag := range in.Request.Tags {
		tagFilters[tag.Name] = struct{}{}
	}

	for _, group := range in.Request.Groups {
		if g, ok := c.groupCache[group.Name]; ok {
			for _, tag := range g.Tags {
				tagFilters[tag] = struct{}{}
			}
		} else {
			return nil, utils.GroupNotFoundError
		}
	}

	log.Debugf("Tag Filters: %v", tagFilters)

	return tagFilters, nil
}

func (c *CartographerServer) Add(_ context.Context, in *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {

	// record the duration of the add operation
	defer metrics.RecordOperationDuration("add")()

	for _, link := range in.Request.GetLinks() {
		auto.ProcessAutoTags(link, c.config.AutoTags)
	}

	newData := make(map[string]any)

	// This needs to be refactored with more constructors/factories etc
	// Get links
	// should make a dataMap constructor
	for _, v := range in.Request.GetLinks() {
		newData[v.GetKey()] = v
		c.AddToCache(v)
		metrics.IncrementObjectCount("link", 1)
	}

	// Add Groups
	for _, v := range in.Request.Groups {
		log.Debugf("Adding group %+v", v)
		// currently groups are not stored in the backend
		c.AddToCache(v)
		metrics.IncrementObjectCount("group", 1)
	}

	ar := backend.NewBackendAddRequest(newData)

	// run the add
	b := c.Backend.Add(ar)

	// process the response
	r := proto.NewCartographerResponse()

	for _, v := range b.Data {
		l := &proto.Link{}

		json.Unmarshal(v, l)
		r.Links = append(r.Links, l)
	}

	go c.Notifier.Publish(r)

	return &proto.CartographerAddResponse{Response: r}, nil
}

func (c *CartographerServer) Get(_ context.Context, in *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {

	// record the duration of the get operation
	defer metrics.RecordOperationDuration("get")()

	r := &proto.CartographerGetResponse{
		Response: &proto.CartographerResponse{},
	}

	log.Tracef("Get Request: %v", in.Type)

	switch in.Type {
	// RequestType_REQUEST_TYPE_DATA returns a list of links
	// It can be filtered tags either supplied collectively as a group, or by individual tag
	case proto.RequestType_REQUEST_TYPE_DATA:
		// establish the tag filters
		tagFilters, err := c.PrepFilters(in)
		if err != nil {
			return nil, err
		}

		// If no tags are supplied, send all links
		if len(tagFilters) == 0 {
			for _, link := range c.cache {
				r.Response.Links = append(r.Response.Links, link)
			}
			return r, nil
		}

		// If tags are supplied, send the links that match the tags
		for tag := range tagFilters {
			r.Response.Links = append(r.Response.Links, c.tagCache[tag]...)
		}

	// RequestType_REQUEST_TYPE_GROUP returns a list of groups from the cache
	case proto.RequestType_REQUEST_TYPE_GROUP:
		for _, group := range c.groupCache {
			r.Response.Groups = append(r.Response.Groups, group.Name)
		}
	// RequestType_REQUEST_TYPE_TAG returns a list of tags from the cache
	case proto.RequestType_REQUEST_TYPE_TAG:
		for tag := range c.tagCache {
			r.Response.Tags = append(r.Response.Tags, tag)
		}

	case proto.RequestType_REQUEST_TYPE_UNSPECIFIED:
		log.Infof("unknown RequestType")
		return nil, errors.New("unknown RequestType")
	}

	return r, nil
}

func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {

	// record the duration of the delete operation
	defer metrics.RecordOperationDuration("delete")()

	// This needs more thought, we should be able to handle multiple deletes in a single request
	keys := make([]string, 0)

	switch {
	case in.Request.Links != nil:
		for _, link := range in.Request.GetLinks() {
			keys = append(keys, link.GetKey())
		}
	case in.Request.Groups != nil:
		for _, group := range in.Request.GetGroups() {
			keys = append(keys, group.Name)
		}
	default:
		return nil, errors.New("no keys to delete")
	}

	c.DeleteFromCache(keys...)

	r := c.Backend.Delete(backend.NewBackendRequest(keys...))

	if len(r.Errors) > 0 {
		return nil, fmt.Errorf("error deleting keys: %v", r.Errors)
	}

	resp := &proto.CartographerDeleteResponse{
		Response: &proto.CartographerResponse{},
	}

	for k := range r.Data {
		resp.Response.Msg = append(resp.Response.Msg, k)
	}

	return resp, nil
}

func (c *CartographerServer) StreamGet(in *proto.CartographerStreamGetRequest, stream grpc.ServerStreamingServer[proto.CartographerStreamGetResponse]) error {

	// https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc

	s := proto.CartographerStreamGetResponse{
		Response: proto.NewCartographerResponse(),
	}

	for _, v := range c.cache {
		s.Response.Links = append(s.Response.Links, v)
	}

	if err := stream.Send(&s); err != nil {
		return err
	}

	notifier := c.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go c.Notifier.Unsubscribe(stream.Context(), notifier.Id)

	for {
		<-notifier.Channel
		for _, v := range c.cache {
			s.Response.Links = append(s.Response.Links, v)
		}

		if err := stream.Send(&s); err != nil {
			return err
		}
	}
}
