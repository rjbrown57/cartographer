package inmemory

import (
	"log"

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

// StreamGet is a server side streaming RPC that sends multiple responses to a client as changes occur
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
	go i.Notifier.Unsubscribe(stream.Context(), c.Id)

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
