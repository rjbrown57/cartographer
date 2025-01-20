package inmemory

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/stretchr/testify/assert"
)

func TestInMemoryBackend_Add(t *testing.T) {

	backend := PrepTest(t)

	req := &proto.CartographerAddRequest{
		Request: &proto.CartographerRequest{
			Links: []*proto.Link{
				{Url: "http://example.com"},
			},
			Tags: []*proto.Tag{
				{Name: "example"},
			},
			Groups: []*proto.Group{
				{Name: "exampleGroup"},
			},
		},
	}

	resp, err := backend.Add(req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Contains(t, resp.Response.Msg, "Adding http://example.com")

	// Verify link was added
	link, exists := backend.Links["http://example.com"]
	assert.True(t, exists)
	assert.NotNil(t, link)

	// Verify tag was added
	tag, exists := backend.Tags["example"]
	assert.True(t, exists)
	assert.NotNil(t, tag)
	assert.Contains(t, tag.Links, link)

	// Verify group was added
	group := backend.Groups.GetGroup("exampleGroup")
	assert.NotNil(t, group)
	assert.Contains(t, group.GroupTags, tag)
}
