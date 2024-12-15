package data

import (
	"fmt"
	"net/url"
	"strings"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
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

func NewFromProtoLink(l *proto.Link) (*Link, error) {
	d, err := NewLink(l.Url)
	if err != nil {
		return nil, err
	}
	d.Description = l.Description
	d.DisplayName = l.Displayname
	d.DisplayName = d.SetDisplayName()

	return d, nil
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

func (l *Link) SetDisplayName() string {

	if s, cut := strings.CutPrefix(l.Link.String(), fmt.Sprintf("%s://", l.Link.Scheme)); cut {
		return s
	}

	return l.DisplayName
}
