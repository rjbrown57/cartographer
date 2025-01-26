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

	// If no display name was set, set the generic display name
	if l.Displayname == "" {
		d.SetDisplayName()
		return d, nil
	}

	d.DisplayName = l.Displayname

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

func (l *Link) SetDisplayName() {
	if s, cut := strings.CutPrefix(l.Link.String(), fmt.Sprintf("%s://", l.Link.Scheme)); cut {
		l.DisplayName = s
	}
}

func (l *Link) AddTag(tag *Tag) {

	tm := make(map[string]struct{})

	for _, t := range l.Tags {
		tm[t.Name] = struct{}{}
	}

	if _, exists := tm[tag.Name]; !exists {
		l.Tags = append(l.Tags, tag)
	}
}
