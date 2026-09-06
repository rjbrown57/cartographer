package server

import (
	"context"
	"errors"
	"fmt"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"

	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

// Delete removes durably deleted notes from the live cache and search index.
func (c *CartographerServer) Delete(_ context.Context, in *proto.CartographerDeleteRequest) (*proto.CartographerDeleteResponse, error) {
	// record the duration of the delete operation
	defer metrics.Metrics().RecordOperationDuration("delete")()
	if in == nil {
		return nil, errors.New("delete request is required")
	}

	ns, err := proto.GetNamespace(in.GetNamespace())
	if err != nil {
		return nil, err
	}

	// The backend response is the acknowledgement boundary. Notes that were
	// not durably deleted must remain visible so clients can retry them.
	r := c.Backend.Delete(in)
	if r == nil {
		return nil, errors.New("backend returned an empty delete response")
	}
	if len(r.GetIds()) > 0 {
		c.DeleteFromCache(ns, r.GetIds()...)
	}

	if len(r.GetErrors()) > 0 {
		return r, fmt.Errorf("error deleting keys: %s", r.GetErrors())
	}

	return r, nil
}
