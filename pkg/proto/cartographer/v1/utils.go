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

// NewCartographerRequest builds a note request from URL-style CLI inputs.
func NewCartographerRequest(urls, tags []string, namespace string) (*CartographerRequest, error) {
	newNotes := make([]*Note, 0)

	deDupMap := make(map[string]struct{})

	for _, noteURL := range urls {
		if _, ok := deDupMap[noteURL]; !ok {
			note, err := NewNoteBuilder().
				WithURL(noteURL).
				WithTags(tags).
				Build()
			if err != nil {
				return nil, err
			}
			newNotes = append(newNotes, note)
		}
		deDupMap[noteURL] = struct{}{}
	}

	// validate namespaces matches regex and if unset set to default
	validatedNs, err := GetNamespace(namespace)
	if err != nil {
		return nil, err
	}

	r := CartographerRequest{
		Notes:     newNotes,
		Namespace: validatedNs,
	}

	return &r, nil
}

func GetRequestFromStream(c *CartographerStreamGetRequest) *CartographerGetRequest {

	return &CartographerGetRequest{
		Request: &CartographerRequest{
			Tags:  c.Request.GetTags(),
			Notes: c.Request.GetNotes(),
		},
		Type: c.Type,
	}
}

func NewCartographerGetRequest(noteURLs, tags []string, namespace string) *CartographerGetRequest {
	r, err := NewCartographerRequest(noteURLs, tags, namespace)
	if err != nil {
		log.Fatalf("Error building cartographer request: %s", err)
	}
	return &CartographerGetRequest{
		Request: r,
	}
}

func NewCartographerAddRequest(noteURLs, tags []string, namespace string) *CartographerAddRequest {
	r, err := NewCartographerRequest(noteURLs, tags, namespace)
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
