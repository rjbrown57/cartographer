package proto

import (
	"fmt"
	"regexp"

	"github.com/rjbrown57/cartographer/pkg/log"
)

var (
	DefaultNamespace = "default"
	nsregex          = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
	nsre             = regexp.MustCompile(nsregex)
)

func NewProtoTag(tagName, description string) *Tag {
	t := Tag{Name: tagName}
	return &t
}

func NewCartographerRequest(links, tags, groups []string, namespace string) (*CartographerRequest, error) {
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

	// validate namespaces matches regex and if unset set to default
	validatedNs, err := GetNamespace(namespace)
	if err != nil {
		return nil, err
	}

	r := CartographerRequest{
		Links:     newlinks,
		Groups:    newGroups,
		Namespace: validatedNs,
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

func NewCartographerGetRequest(links, tags, groups []string, namespace string) *CartographerGetRequest {
	r, err := NewCartographerRequest(links, tags, groups, namespace)
	if err != nil {
		log.Fatalf("Error building cartographer request: %s", err)
	}
	return &CartographerGetRequest{
		Request: r,
	}
}

func NewCartographerAddRequest(links, tags, groups []string, namespace string) *CartographerAddRequest {
	r, err := NewCartographerRequest(links, tags, groups, namespace)
	if err != nil {
		log.Fatalf("Error building cartographer request: %s", err)
	}
	return &CartographerAddRequest{
		Request: r,
	}
}

func NewCartographerDeleteRequest(ids []string, namespace string) *CartographerDeleteRequest {
	validatedNs, err := GetNamespace(namespace)
	if err != nil {
		log.Fatalf("Error building cartographer delete request: %s", err)
	}

	c := &CartographerDeleteRequest{
		Ids:       ids,
		Namespace: validatedNs,
	}

	return c
}

func NewCartographerResponse() *CartographerResponse {
	return &CartographerResponse{}
}

// GetNamespace will validate a supplied namespace or return the default if unset
func GetNamespace(n string) (string, error) {
	if n != "" {
		if nsre.MatchString(n) {
			return n, nil
		}
		return "", fmt.Errorf("namespace %q does not match required format", n)
	}

	return DefaultNamespace, nil
}
