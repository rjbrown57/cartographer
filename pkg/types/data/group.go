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
