package inmemory

import (
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

// TODO I hate this function
func (i *InMemoryBackend) Get(r *proto.CartographerGetRequest) (*proto.CartographerGetResponse, error) {

	log.Printf("Get Request %s", r.Type.String())

	var err error
	resp := &proto.CartographerGetResponse{
		Response: proto.NewCartographerResponse(),
	}

	switch r.Type {
	// return all known groups
	case proto.RequestType_REQUEST_TYPE_GROUP:
		resp.Response.Groups = append(resp.Response.Groups, i.Groups.GetGroupNames()...)
	// return all known tags
	case proto.RequestType_REQUEST_TYPE_TAG:
		resp.Response.Tags = append(resp.Response.Tags, i.Tags.GetTagsNames()...)
	case proto.RequestType_REQUEST_TYPE_UNSPECIFIED:
		fallthrough
	case proto.RequestType_REQUEST_TYPE_DATA:
		resp.Response, err = i.ProcessDataRequest(r.Request)
		if err != nil {
			return nil, err
		}
	}

	return resp, nil
}

func (i *InMemoryBackend) StreamGet(pr *proto.CartographerStreamGetRequest, stream grpc.ServerStreamingServer[proto.CartographerStreamGetResponse]) error {

	s := proto.CartographerStreamGetResponse{
		Response: proto.NewCartographerResponse(),
	}

	// Send first response
	resp, err := i.Get(proto.GetRequestFromStream(pr))
	if err != nil {
		log.Printf("Error getting data: %s", err)
	}

	s.Response = resp.Response

	if err := stream.Send(&s); err != nil {
		return err
	}

	c := i.Notifier.Subscribe()

	// this will unregister if the context is cancelled
	go i.Notifier.Unsubscribe(stream.Context(), c.Id)

	for {
		prr := <-c.Channel

		switch v := prr.(type) {
		case *proto.CartographerResponse:
			// currently this will send the same query on change
			// so if a change occurs that does not have anything meaningful to this request
			// we will notify anyways but without anything useful for the consumer
			// the main usecase for watch at this time is query for all data
			// so this problem is not a big deal right now
			gr, err := i.Get(proto.GetRequestFromStream(pr))
			if err != nil {
				log.Printf("Error getting data: %s", err)
				return err
			}

			gr.Response.Msg = v.Msg

			s := proto.CartographerStreamGetResponse{
				Response: gr.Response,
			}
			if err := stream.Send(&s); err != nil {
				return err
			}
		default:
			return nil
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
						for _, link := range t.Links {
							lm[link.Link.String()] = link.GetProtoLink()
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
