package server

import (
	"context"
	"errors"
	"fmt"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {

	// record the duration of the delete operation
	defer metrics.RecordOperationDuration("delete")()

	// This needs more thought, we should be able to handle multiple deletes in a single request
	keys := make([]string, 0)

	switch {
	case in.Request.Links != nil:
		for _, link := range in.Request.GetLinks() {
			keys = append(keys, link.GetKey())
		}
	case in.Request.Groups != nil:
		for _, group := range in.Request.GetGroups() {
			keys = append(keys, group.Name)
		}
	default:
		return nil, errors.New("no keys to delete")
	}

	c.DeleteFromCache(keys...)

	r := c.Backend.Delete(backend.NewBackendRequest(keys...))

	if len(r.Errors) > 0 {
		return nil, fmt.Errorf("error deleting keys: %v", r.Errors)
	}

	resp := &proto.CartographerDeleteResponse{
		Response: &proto.CartographerResponse{},
	}

	for k := range r.Data {
		resp.Response.Msg = append(resp.Response.Msg, k)
	}

	return resp, nil
}
