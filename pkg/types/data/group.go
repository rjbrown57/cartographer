package data

import "gopkg.in/yaml.v3"

// Related Links are grouped together
type Group struct {
	GroupTags []*Tag
	Links     []*Link
	Name      string
}

func NewGroup(name string) *Group {
	return &Group{
		Name:      name,
		GroupTags: nil,
	}
}

func (lg *Group) GetBytes() []byte {
	if bytes, err := yaml.Marshal(lg); err == nil {
		return bytes
	}
	return nil
}

func (lg *Group) AddTag(tag *Tag) {

	tm := make(map[string]struct{})

	for _, t := range lg.GroupTags {
		tm[t.Name] = struct{}{}
	}

	if _, exists := tm[tag.Name]; !exists {
		lg.GroupTags = append(lg.GroupTags, tag)
	}
}
