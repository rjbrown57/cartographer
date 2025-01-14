package inmemory

import (
	"log"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

// TODO I hate this function
func (i *InMemoryBackend) Get(r *proto.CartographerRequest) (*proto.CartographerResponse, error) {

	log.Printf("Get Request %s", r.Type.String())

	var err error
	resp := &proto.CartographerResponse{}

	switch r.Type {
	// return all known groups
	case proto.RequestType_GROUP:
		resp.Groups = append(resp.Groups, i.Groups.GetGroupNames()...)
	// return all known tags
	case proto.RequestType_TAG:
		resp.Tags = append(resp.Tags, i.Tags.GetTagsNames()...)
	case proto.RequestType_DATA:
		resp, err = i.ProcessDataRequest(r)
		if err != nil {
			return nil, err
		}
	}

	return resp, nil
}

// This will respond to a pr every 5 seconds
// It would be better if we could notify when a record is added/updated/deleted which causes all streams to update
func (i *InMemoryBackend) StreamGet(pr *proto.CartographerRequest, stream grpc.ServerStreamingServer[proto.CartographerResponse]) error {
	log.Printf("StreamGet Request %+v", pr)

	// This is working but is still dumb
	// We should use request type to choose when to send updates
	// If passed notification shows the correct requesttype we should send an update
	// We likely need to add new RequestTypes to the proto file
	for {
		resp, err := i.Get(pr)
		if err != nil {
			log.Printf("Error getting data: %s", err)
		}
		// Send the response
		if err := stream.Send(resp); err != nil {
			return err
		}
		time.Sleep(5 * time.Second)
	}
}

func (i *InMemoryBackend) ProcessDataRequest(r *proto.CartographerRequest) (*proto.CartographerResponse, error) {

	resp := &proto.CartographerResponse{}

	responseLinks := make([]*proto.Link, 0)

	// proto.RequestType_DATA
	switch {
	case r.Groups == nil && r.Tags == nil:
		resp.Groups = i.Groups.GetGroupNames()
		resp.Links = i.Links.GetProtoLinks()
		resp.Tags = i.Tags.GetTagsNames()
		return resp, nil
	case r.Tags != nil:
		for _, tag := range r.Tags {
			// TODO refine this
			// this is duplicating links that are in multiple tags
			lm := make(map[string]*proto.Link, 0)
			if t, exists := i.Tags[tag.Name]; exists {
				resp.Tags = append(resp.Tags, t.Name)
				// prevent duplication
				for _, link := range t.Links {
					lm[link.Link.String()] = link.GetProtoLink()
					//responseLinks = append(responseLinks, link.GetProtoLink())
				}
				for _, link := range lm {
					responseLinks = append(responseLinks, link)
				}
			}
		}
	case r.Groups != nil:
		for _, group := range r.Groups {
			if g := i.Groups.GetGroup(group.Name); g != nil {
				resp.Groups = append(resp.Groups, g.Name)
				for _, tag := range g.GroupTags {
					resp.Tags = append(resp.Tags, tag.Name)
					// TODO refine this
					// this is duplicating links that are in multiple tags
					lm := make(map[string]*proto.Link, 0)
					if t, exists := i.Tags[tag.Name]; exists {
						resp.Tags = append(resp.Tags, t.Name)
						for _, link := range t.Links {
							lm[link.Link.String()] = link.GetProtoLink()
							//responseLinks = append(responseLinks, link.GetProtoLink())
						}
						for _, link := range lm {
							responseLinks = append(responseLinks, link)
						}
					}
				}
			}
		}
	}

	resp.Links = responseLinks

	return resp, nil
}
