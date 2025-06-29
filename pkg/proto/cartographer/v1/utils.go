package proto

import (
	"fmt"
	"log"
	"net/url"
)

// New ProtoLink is a constructor for proto.Link
func NewProtoLink(link string, description string, displayName string, tags []string) *Link {

	l := Link{Url: link, Description: description, Displayname: displayName, Tags: tags}

	if displayName == "" {
		l.Displayname = link
	}

	return &l
}

func SetDisplayName(l *Link) {

	if l.Displayname != "" {
		return
	}

	u, err := url.Parse(l.Url)
	if err != nil {
		log.Fatalf("error parsing url: %v", err)
	}

	l.Displayname = fmt.Sprintf("%s%s", u.Host, u.Path)
}

func NewProtoGroup(groupName string, tags []string, description string) *Group {
	g := Group{Name: groupName, Tags: tags, Description: description}
	return &g
}

func NewProtoTag(tagName, description string) *Tag {
	t := Tag{Name: tagName}
	return &t
}

func NewCartographerRequest(links, tags, groups []string) *CartographerRequest {
	newlinks := make([]*Link, 0)

	deDupMap := make(map[string]struct{})

	for _, link := range links {
		if _, ok := deDupMap[link]; !ok {
			newlinks = append(newlinks, NewProtoLink(link, "", "", tags))
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

	return &r
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
	return &CartographerGetRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerAddRequest(links, tags, groups []string) *CartographerAddRequest {
	return &CartographerAddRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerDeleteRequest(links, tags, groups []string) *CartographerDeleteRequest {
	return &CartographerDeleteRequest{
		Request: NewCartographerRequest(links, tags, groups),
	}
}

func NewCartographerResponse() *CartographerResponse {
	return &CartographerResponse{}
}
