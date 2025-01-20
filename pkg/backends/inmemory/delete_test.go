package inmemory

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/data"

	"github.com/stretchr/testify/assert"
)

func TestInMemoryBackend_Delete(t *testing.T) {
	backend := PrepTest(t)

	// Setup initial data
	l, err := data.NewLink("http://example.com")
	if err != nil {
		t.Fatalf("error creating link: %s", err)
	}

	backend.Links["http://example.com"] = l
	backend.Tags["example"] = data.NewTag("example")
	backend.Groups["group1"] = data.NewGroup("group1")

	// Create a request to delete the data
	request := &proto.CartographerDeleteRequest{
		Request: &proto.CartographerRequest{
			Links: []*proto.Link{
				{Url: "http://example.com"},
			},
			Tags: []*proto.Tag{
				{Name: "example"},
			},
			Groups: []*proto.Group{
				{Name: "group1"},
			},
		},
	}

	// Call the Delete method
	response, err := backend.Delete(request)

	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, response)

	// Verify that the data has been deleted
	_, linkExists := backend.Links["http://example.com"]
	_, tagExists := backend.Tags["example"]
	_, groupExists := backend.Groups["group1"]

	assert.False(t, linkExists)
	assert.False(t, tagExists)
	assert.False(t, groupExists)
}
