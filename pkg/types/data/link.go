package data

import (
	"net/url"

	"github.com/rjbrown57/cartographer/pkg/proto"
)

type Link struct {
	Description string
	DisplayName string
	Link        *url.URL
	Tags        []*Tag
}

// Eventually add validation
func NewLink(rawString string) (*Link, error) {

	var err error

	l := Link{}
	l.Link, err = url.Parse(rawString)

	return &l, err
}

func (l *Link) GetTagNames() []string {

	tagNames := make([]string, 0)

	for _, tag := range l.Tags {
		tagNames = append(tagNames, tag.Name)
	}

	return tagNames
}

func (l *Link) GetProtoLink() *proto.Link {
	return proto.NewProtoLink(l.Link.String(), l.Description, l.DisplayName, l.GetTagNames())
}
