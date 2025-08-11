package server

import (
	"context"
	"encoding/json"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

func (c *CartographerServer) Add(_ context.Context, in *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {

	// record the duration of the add operation
	defer metrics.RecordOperationDuration("add")()

	for _, link := range in.Request.GetLinks() {
		auto.ProcessAutoTags(link, c.config.AutoTags)
	}

	newData := make(map[string]any)

	// This needs to be refactored with more constructors/factories etc
	// Get links
	// should make a dataMap constructor
	for _, v := range in.Request.GetLinks() {
		newData[v.GetKey()] = v
		c.AddToCache(v)
		metrics.IncrementObjectCount("link", 1)
	}

	// Add Groups
	for _, v := range in.Request.Groups {
		log.Debugf("Adding group %+v", v)
		// currently groups are not stored in the backend
		c.AddToCache(v)
		metrics.IncrementObjectCount("group", 1)
	}

	ar := backend.NewBackendAddRequest(newData)

	// run the add
	b := c.Backend.Add(ar)

	// process the response
	r := proto.NewCartographerResponse()

	for _, v := range b.Data {
		l := &proto.Link{}

		json.Unmarshal(v, l)
		r.Links = append(r.Links, l)
	}

	go c.Notifier.Publish(r)

	return &proto.CartographerAddResponse{Response: r}, nil
}
