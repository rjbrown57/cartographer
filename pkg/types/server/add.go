package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

	if in == nil || in.GetRequest() == nil {
		return nil, errors.New("add request is required")
	}

	ns, err := proto.GetNamespace(in.GetRequest().GetNamespace())
	if err != nil {
		return nil, err
	}

	newData := make(map[string]any, len(in.GetRequest().GetNotes()))
	for index, requestedNote := range in.GetRequest().GetNotes() {
		if requestedNote == nil {
			return nil, fmt.Errorf("note at index %d is required", index)
		}

		// Work on a clone so metadata and automatic tags are only exposed to
		// callers after the backend has durably accepted the note.
		note := gproto.Clone(requestedNote).(*proto.Note)
		auto.ProcessAutoTags(note, c.config.AutoTags)
		c.applyNoteMetadata(note, ns)
		newData[note.GetKey()] = note
	}

	ar := backend.NewBackendAddRequest(newData, ns)

	// run the add
	b := c.Backend.Add(ar)
	if b == nil {
		return nil, errors.New("backend returned an empty add response")
	}
	if len(b.Errors) > 0 {
		return nil, fmt.Errorf("add notes to backend: %w", errors.Join(b.Errors...))
	}

	// process the response
	r := proto.NewCartographerResponse()

	for _, v := range b.Data {
		n := &proto.Note{}
		if err := json.Unmarshal(v, n); err != nil {
			return nil, fmt.Errorf("decode added note from backend: %w", err)
		}
		r.Notes = append(r.Notes, n)
	}

	// The backend response is the acknowledgement boundary. Cache, index,
	// metrics, and notifications must only observe notes that were persisted.
	for _, note := range r.GetNotes() {
		c.AddToCache(note, ns)
		metrics.Metrics().IncrementObjectCount("note", ns, 1)
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
		tagsEqual(existing.GetTags(), incoming.GetTags()) &&
		maps.Equal(existing.GetAnnotations(), incoming.GetAnnotations()) &&
		gproto.Equal(existing.GetData(), incoming.GetData())
}

// tagsEqual compares tags as an unordered collection without mutating either note.
func tagsEqual(existing, incoming []string) bool {
	if len(existing) != len(incoming) {
		return false
	}

	existingTags := slices.Clone(existing)
	incomingTags := slices.Clone(incoming)
	slices.Sort(existingTags)
	slices.Sort(incomingTags)

	return slices.Equal(existingTags, incomingTags)
}
