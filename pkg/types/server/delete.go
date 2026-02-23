package server

import (
	"context"
	"fmt"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"

	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {

	var err error

	// record the duration of the delete operation
	defer metrics.RecordOperationDuration("delete")()

	ns, err := proto.GetNamespace(in.GetNamespace())
	if err != nil {
		return nil, err
	}

	// delete from cache
	c.DeleteFromCache(ns, in.Ids...)

	// delete from backend
	r := c.Backend.Delete(in)

	if len(r.Errors) > 0 {
		err = fmt.Errorf("error deleting keys: %s", r.Errors)
	}

	return r, err
}
