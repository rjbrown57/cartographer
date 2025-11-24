package proto

import (
	"fmt"
	"net/url"

	"github.com/rjbrown57/cartographer/pkg/log"
	structpb "google.golang.org/protobuf/types/known/structpb"
)

// LinkBuilder is a builder for proto.Link
type LinkBuilder struct {
	link *Link
}

// NewLinkBuilder creates a new LinkBuilder
func NewLinkBuilder() *LinkBuilder {
	return &LinkBuilder{
		link: &Link{},
	}
}

// WithURL sets the URL for the link
func (b *LinkBuilder) WithURL(url string) *LinkBuilder {
	b.link.Url = url
	return b
}

// WithDescription sets the description for the link
func (b *LinkBuilder) WithDescription(desc string) *LinkBuilder {
	b.link.Description = desc
	return b
}

// WithDisplayName sets the display name for the link
func (b *LinkBuilder) WithDisplayName(name string) *LinkBuilder {
	b.link.Displayname = name
	return b
}

// WithTags sets the tags for the link
func (b *LinkBuilder) WithTags(tags []string) *LinkBuilder {
	b.link.Tags = tags
	return b
}

// WithId sets the id for the link
func (b *LinkBuilder) WithId(id string) *LinkBuilder {
	b.link.Id = id
	return b
}

// WithData sets the data for the link
func (b *LinkBuilder) WithData(data map[string]any) *LinkBuilder {

	// If the data is not empty we will add it to the proto.Link
	if len(data) > 0 {
		sp, err := structpb.NewStruct(data)
		if err != nil {
			log.Fatalf("error creating structpb: %v", err)
		}
		b.link.Data = sp
	}

	return b
}

// WithMetadata sets the metadata for the link
func (b *LinkBuilder) WithAnnotations(annotations map[string]string) *LinkBuilder {
	b.link.Annotations = annotations
	return b
}

// Build creates a new Link from the builder
func (b *LinkBuilder) Build() (*Link, error) {
	if b.link.Displayname == "" && b.link.Url != "" {
		b.link.SetDisplayName()
	}

	// If the id is not set and the url is set, set the id to the url
	if b.link.Id == "" && b.link.Url != "" {
		b.link.Id = b.link.Url
	}

	if b.link.Id == "" {
		return nil, fmt.Errorf("id is required - %v", b.link)
	}

	return b.link, nil
}

// SetDisplayName sets the display name for the link
func (l *Link) SetDisplayName() {

	if l.Displayname != "" {
		return
	}

	u, err := url.Parse(l.Url)
	if err != nil {
		log.Fatalf("error parsing url: %v", err)
	}

	l.Displayname = fmt.Sprintf("%s%s", u.Host, u.Path)
}

// GetKey returns the key for the link to be used in cache/backend
func (l *Link) GetKey() string {
	return l.Id
}
