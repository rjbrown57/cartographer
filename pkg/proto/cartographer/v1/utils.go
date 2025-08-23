package proto

import "github.com/rjbrown57/cartographer/pkg/log"

func NewProtoTag(tagName, description string) *Tag {
	t := Tag{Name: tagName}
	return &t
}

func NewCartographerRequest(links, tags, groups []string) (*CartographerRequest, error) {
	newlinks := make([]*Link, 0)

	deDupMap := make(map[string]struct{})

	for _, link := range links {
		if _, ok := deDupMap[link]; !ok {
			pl, err := NewLinkBuilder().
				WithURL(link).
				WithTags(tags).
				Build()
			if err != nil {
				return nil, err
			}
			newlinks = append(newlinks, pl)
		}
		deDupMap[link] = struct{}{}
	}

	deDupMap = make(map[string]struct{})
	newGroups := make([]*Group, 0)
	for _, group := range groups {
		if _, ok := deDupMap[group]; !ok {
			newGroups = append(newGroups, NewProtoGroup(group, tags, ""))
		}
		deDupMap[group] = struct{}{}
	}

	r := CartographerRequest{
		Links:  newlinks,
		Groups: newGroups,
	}

	return &r, nil
}

func GetRequestFromStream(c *CartographerStreamGetRequest) *CartographerGetRequest {
	return &CartographerGetRequest{
		Request: &CartographerRequest{
			Tags:   c.Request.GetTags(),
			Links:  c.Request.GetLinks(),
			Groups: c.Request.GetGroups(),
		},
		Type: c.Type,
	}
}

func NewCartographerGetRequest(links, tags, groups []string) *CartographerGetRequest {
	r, err := NewCartographerRequest(links, tags, groups)
	if err != nil {
		log.Fatalf("Error building cartographer request: %s", err)
	}
	return &CartographerGetRequest{
		Request: r,
	}
}

func NewCartographerAddRequest(links, tags, groups []string) *CartographerAddRequest {
	r, err := NewCartographerRequest(links, tags, groups)
	if err != nil {
		log.Fatalf("Error building cartographer request: %s", err)
	}
	return &CartographerAddRequest{
		Request: r,
	}
}

func NewCartographerDeleteRequest(ids []string) *CartographerDeleteRequest {
	c := &CartographerDeleteRequest{
		Ids: ids,
	}

	return c
}

func NewCartographerResponse() *CartographerResponse {
	return &CartographerResponse{}
}
