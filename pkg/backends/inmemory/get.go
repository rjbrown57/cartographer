package inmemory

import (
	"log"

	"github.com/rjbrown57/cartographer/pkg/proto"
	"google.golang.org/grpc"
)

// TODO I hate this function
func (i *InMemoryBackend) Get(r *proto.CartographerRequest) (*proto.CartographerResponse, error) {

	log.Printf("Get Request %+v", r)

	responseLinks := make([]*proto.Link, 0)
	resp := proto.CartographerResponse{}

	switch r.Type {
	// return all known groups
	case proto.RequestType_GROUP:
		resp.Groups = append(resp.Groups, i.Groups.GetGroupNames()...)
		return &resp, nil
	// return all known tags
	case proto.RequestType_TAG:
		resp.Tags = append(resp.Tags, i.Tags.GetTagsNames()...)
		return &resp, nil
	}

	//proto.RequestType_DATA
	switch {
	case r.Groups == nil && r.Tags == nil:
		resp.Groups = i.Groups.GetGroupNames()
		resp.Links = i.Links.GetProtoLinks()
		resp.Tags = i.Tags.GetTagsNames()
		return &resp, nil
	case r.Tags != nil:
		for _, tag := range r.Tags {
			if t, exists := i.Tags[tag.Name]; exists {
				resp.Tags = append(resp.Tags, t.Name)
				for _, link := range t.Links {
					responseLinks = append(responseLinks, link.GetProtoLink())
				}
			}
		}
	case r.Groups != nil:
		for _, group := range r.Groups {
			if g := i.Groups.GetGroup(group.Name); g != nil {
				resp.Groups = append(resp.Groups, g.Name)
				for _, tag := range g.GroupTags {
					resp.Tags = append(resp.Tags, tag.Name)
					for _, link := range tag.Links {
						responseLinks = append(responseLinks, link.GetProtoLink())
					}
				}
			}
		}
	}

	resp.Links = responseLinks

	return &resp, nil
}

// This will respond to a pr every 5 seconds
// It would be better if we could notify when a record is added/updated/deleted which causes all streams to update
func (i *InMemoryBackend) StreamGet(pr *proto.CartographerRequest, stream grpc.ServerStreamingServer[proto.CartographerResponse]) error {
	log.Printf("StreamGet Request %+v", pr)

	// Send first response and wait for more
	resp, err := i.Get(pr)
	// TODO re-think this
	if err != nil {
		log.Printf("Error getting data: %s", err)
	}
	if err := stream.Send(resp); err != nil {
		return err
	}

	c := i.Notifier.Subscribe(pr.Type)

	// This is not being run on control-c of watcher
	defer i.Notifier.Unsubscribe(c.Id)

	// This is working but is still dumb
	// We should use request type to choose when to send updates
	// If passed notification shows the correct requesttype we should send an update
	// We likely need to add new RequestTypes to the proto file
	for {
		prr := <-c.Channel
		// Send first response and wait for more
		resp, err := i.Get(pr)
		// TODO re-think this
		if err != nil {
			log.Printf("Error getting data: %s", err)
		}

		resp.Msg = prr.Msg
		if err := stream.Send(resp); err != nil {
			return err
		}
	}
}
