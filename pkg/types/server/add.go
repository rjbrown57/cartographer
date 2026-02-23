package server

import (
	"context"
	"encoding/json"

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

	ns, err := proto.GetNamespace(in.Request.Namespace)
	if err != nil {
		return nil, err
	}

	// This needs to be refactored with more constructors/factories etc
	// Get links
	// should make a dataMap constructor
	for _, v := range in.Request.GetLinks() {
		newData[v.GetKey()] = v
		c.AddToCache(v, ns)
		metrics.IncrementObjectCount("link", 1)
	}

	ar := backend.NewBackendAddRequest(newData, ns)

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
