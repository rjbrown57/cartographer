package server

import (
	"context"
	"encoding/json"
	"maps"
	"slices"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/auto"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
	gproto "google.golang.org/protobuf/proto"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

// Add writes notes into the live server, applying metadata defaults and indexing them.
func (c *CartographerServer) Add(_ context.Context, in *proto.CartographerAddRequest) (*proto.CartographerAddResponse, error) {

	// record the duration of the add operation
	defer metrics.Metrics().RecordOperationDuration("add")()

	for _, note := range in.Request.GetNotes() {
		auto.ProcessAutoTags(note, c.config.AutoTags)
	}

	newData := make(map[string]any)

	ns, err := proto.GetNamespace(in.Request.Namespace)
	if err != nil {
		return nil, err
	}

	// This needs to be refactored with more constructors/factories etc
	// Get notes
	// should make a dataMap constructor
	for _, v := range in.Request.GetNotes() {
		c.applyNoteMetadata(v, ns)
		newData[v.GetKey()] = v
		c.AddToCache(v, ns)
		metrics.Metrics().IncrementObjectCount("note", ns, 1)
	}

	ar := backend.NewBackendAddRequest(newData, ns)

	// run the add
	b := c.Backend.Add(ar)

	// process the response
	r := proto.NewCartographerResponse()

	for _, v := range b.Data {
		n := &proto.Note{}

		json.Unmarshal(v, n)
		r.Notes = append(r.Notes, n)
	}

	go c.Notifier.Publish(r)

	return &proto.CartographerAddResponse{Response: r}, nil
}

// applyNoteMetadata fills lifecycle fields for created and updated notes.
func (c *CartographerServer) applyNoteMetadata(note *proto.Note, ns string) {
	now := timestamppb.New(time.Now().UTC())

	c.mu.RLock()
	cn := c.nsCache[ns]
	c.mu.RUnlock()

	var existing *proto.Note
	if cn != nil {
		cn.mu.RLock()
		existing = cn.NoteCache[note.GetKey()]
		cn.mu.RUnlock()
	}

	if existing != nil {
		if note.GetCreatedAt() == nil {
			note.CreatedAt = existing.GetCreatedAt()
		}
		if note.GetSource() == "" {
			note.Source = existing.GetSource()
		}
		if note.GetAuthor() == "" {
			note.Author = existing.GetAuthor()
		}
		if noteContentEqual(existing, note) {
			note.UpdatedAt = existing.GetUpdatedAt()
			note.Version = existing.GetVersion()
			return
		}
		if note.GetVersion() == 0 {
			note.Version = existing.GetVersion() + 1
		}
	} else {
		if note.GetCreatedAt() == nil {
			note.CreatedAt = now
		}
		if note.GetVersion() == 0 {
			note.Version = 1
		}
	}

	if note.GetUpdatedAt() == nil {
		note.UpdatedAt = now
	}
	if note.GetSource() == "" {
		note.Source = "cartographer"
	}
}

// noteContentEqual compares the durable user-authored fields for two notes.
func noteContentEqual(existing, incoming *proto.Note) bool {
	return existing.GetId() == incoming.GetId() &&
		existing.GetTitle() == incoming.GetTitle() &&
		existing.GetBody() == incoming.GetBody() &&
		existing.GetUrl() == incoming.GetUrl() &&
		slices.Equal(existing.GetTags(), incoming.GetTags()) &&
		maps.Equal(existing.GetAnnotations(), incoming.GetAnnotations()) &&
		gproto.Equal(existing.GetData(), incoming.GetData())
}
