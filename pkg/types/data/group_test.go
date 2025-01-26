package data

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v3"
)

func TestNewGroup(t *testing.T) {
	group := NewGroup("testGroup")
	assert.NotNil(t, group)
	assert.Equal(t, "testGroup", group.Name)
	assert.Nil(t, group.GroupTags)
	assert.Nil(t, group.Links)
}

func TestGroup_GetBytes(t *testing.T) {
	group := NewGroup("testGroup")
	bytes := group.GetBytes()
	assert.NotNil(t, bytes)

	var unmarshalledGroup Group
	err := yaml.Unmarshal(bytes, &unmarshalledGroup)
	assert.Nil(t, err)
	assert.Equal(t, group.Name, unmarshalledGroup.Name)
}

func TestGroup_AddTag(t *testing.T) {
	group := NewGroup("testGroup")
	tag1 := &Tag{Name: "tag1"}
	tag2 := &Tag{Name: "tag2"}

	group.AddTag(tag1)
	assert.Equal(t, 1, len(group.GroupTags))
	assert.Equal(t, "tag1", group.GroupTags[0].Name)

	group.AddTag(tag2)
	assert.Equal(t, 2, len(group.GroupTags))
	assert.Equal(t, "tag2", group.GroupTags[1].Name)

	// Adding the same tag again should not increase the length
	group.AddTag(tag1)
	assert.Equal(t, 2, len(group.GroupTags))
}
