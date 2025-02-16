package server

import (
	"context"
	"errors"
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
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
			return nil, errors.New(fmt.Sprintf("Group %s not found", group.Name))
		}
	}

	log.Printf("Tag Filters: %v", tagFilters)

	return tagFilters, nil
}

func (c *CartographerServer) Add(_ context.Context, in *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {
	for _, link := range in.Request.GetLinks() {
		auto.ProcessAutoTags(link, c.config.AutoTags)
	}

	d := make(map[string]interface{})

	// This needs to be refactored with more constructors/factories etc
	// Get links
	// should make a dataMap constructor
	for _, v := range in.Request.GetLinks() {
		proto.SetDisplayName(v)
		d[v.Url] = v
		c.AddToCache(v)
	}

	// Add Groups
	for _, v := range in.Request.Groups {
		log.Printf("Adding group %+v", v)
		d[v.Name] = v
		c.AddToCache(v)
	}

	ar := backend.NewBackendAddRequest(d)

	// run the add
	b := c.Backend.Add(ar)

	// process the response
	r := proto.NewCartographerResponse()

	for _, v := range b.Data {
		switch v.(type) {
		case *proto.Link:
			l := v.(*proto.Link)
			r.Links = append(r.Links, l)
		case *proto.Group:
			g := v.(*proto.Group)
			r.Groups = append(r.Groups, g.Name)
		}
	}

	go c.Notifier.Publish(b)

	return &proto.CartographerAddResponse{Response: r}, nil
}

func (c *CartographerServer) Get(_ context.Context, in *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {

	r := &proto.CartographerGetResponse{
		Response: &proto.CartographerResponse{},
	}

	log.Printf("Get Request: %v", in.Type)

	switch in.Type {
	// RequestType_REQUEST_TYPE_DATA returns a list of links
	// It can be filtered tags either supplied collectively as a group, or by individual tag
	case proto.RequestType_REQUEST_TYPE_DATA:
		// establish the tag filters
		tagFilters, err := c.PrepFilters(in)
		if err != nil {
			return nil, err
		}

		for _, v := range c.cache {
			switch v.(type) {
			case *proto.Link:
				// if we have no tags send all inks
				if len(tagFilters) == 0 {
					r.Response.Links = append(r.Response.Links, v.(*proto.Link))
					continue
				}

				// if we have tags, we need to filter the links
				for _, tag := range v.(*proto.Link).Tags {
					if _, ok := tagFilters[tag]; ok {
						r.Response.Links = append(r.Response.Links, v.(*proto.Link))
					}
				}
			case *proto.Group:
				r.Response.Groups = append(r.Response.Groups, v.(*proto.Group).Name)
			}
		}
	// RequestType_REQUEST_TYPE_GROUP returns a list of groups from the cache
	case proto.RequestType_REQUEST_TYPE_GROUP:
		for _, group := range c.groupCache {
			r.Response.Groups = append(r.Response.Groups, group.Name)
		}
	// RequestType_REQUEST_TYPE_TAG returns a list of tags from the cache
	case proto.RequestType_REQUEST_TYPE_TAG:
		for _, tag := range c.tagCache {
			r.Response.Tags = append(r.Response.Tags, tag.Name)
		}

	case proto.RequestType_REQUEST_TYPE_UNSPECIFIED:
		log.Printf("Unknown RequestType")
		return nil, errors.New("Unknown RequestType")
	}

	return r, nil
}

func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {

	keys := make([]string, 0)

	for _, link := range in.Request.GetLinks() {
		keys = append(keys, link.Url)
	}

	for _, group := range in.Request.GetGroups() {
		keys = append(keys, group.Name)
	}

	c.DeleteFromCache(keys...)

	// TODO FIX
	r := c.Backend.Delete(backend.NewBackendRequest("", keys...))

	if len(r.Errors) > 0 {
		return nil, errors.New(fmt.Sprintf("Error deleting keys: %v", r.Errors))
	}

	resp := &proto.CartographerDeleteResponse{
		Response: &proto.CartographerResponse{},
	}

	for k, _ := range r.Data {
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
		switch v.(type) {
		case *proto.Link:
			s.Response.Links = append(s.Response.Links, v.(*proto.Link))
		case *proto.Group:
			s.Response.Groups = append(s.Response.Groups, v.(*proto.Group).Name)
		}
	}

	if err := stream.Send(&s); err != nil {
		return err
	}

	notifier := c.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go c.Notifier.Unsubscribe(stream.Context(), notifier.Id)

	for {
		_ = <-notifier.Channel
		for _, v := range c.cache {
			switch v.(type) {
			case *proto.Link:
				s.Response.Links = append(s.Response.Links, v.(*proto.Link))
			case *proto.Group:
				s.Response.Groups = append(s.Response.Groups, v.(*proto.Group).Name)
			}
		}

		if err := stream.Send(&s); err != nil {
			return err
		}
	}
}
