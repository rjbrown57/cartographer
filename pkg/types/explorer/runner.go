package explorer

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	gproto "google.golang.org/protobuf/proto"
)

// Runner discovers and reconciles authoritative explorer snapshots.
type Runner struct {
	explorer         Explorer
	client           CartographerClient
	interval         time.Duration
	discoveryTimeout time.Duration
	mu               sync.Mutex
}

// NewRunner validates runner dependencies and constructs a snapshot runner.
func NewRunner(options RunnerOptions) (*Runner, error) {
	if options.Explorer == nil {
		return nil, errors.New("explorer is required")
	}
	if options.Client == nil {
		return nil, errors.New("cartographer client is required")
	}
	if options.Interval < 0 {
		return nil, errors.New("runner interval cannot be negative")
	}
	if options.DiscoveryTimeout < 0 {
		return nil, errors.New("discovery timeout cannot be negative")
	}

	if _, _, err := explorerIdentity(options.Explorer); err != nil {
		return nil, err
	}

	return &Runner{
		explorer:         options.Explorer,
		client:           options.Client,
		interval:         options.Interval,
		discoveryTimeout: options.DiscoveryTimeout,
	}, nil
}

// Run executes an immediate reconciliation and optionally continues on an interval.
func (r *Runner) Run(ctx context.Context) error {
	if r.interval == 0 {
		_, err := r.RunOnce(ctx)
		return err
	}

	r.runAndLog(ctx)
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			r.runAndLog(ctx)
		}
	}
}

// RunOnce discovers, validates, and reconciles one complete source snapshot.
func (r *Runner) RunOnce(ctx context.Context) (*ReconcileResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	sourceID, namespace, err := explorerIdentity(r.explorer)
	if err != nil {
		return nil, err
	}

	discoveryCtx := ctx
	cancel := func() {}
	if r.discoveryTimeout > 0 {
		discoveryCtx, cancel = context.WithTimeout(ctx, r.discoveryTimeout)
	}
	defer cancel()

	discovered, err := r.explorer.Discover(discoveryCtx)
	if err != nil {
		return nil, fmt.Errorf("discover explorer source %q: %w", sourceID, err)
	}

	desired, err := prepareSnapshot(discovered, sourceID)
	if err != nil {
		return nil, err
	}

	current, err := r.getCurrentNotes(ctx, namespace)
	if err != nil {
		return nil, err
	}

	result := &ReconcileResult{
		SourceID:   sourceID,
		Namespace:  namespace,
		Discovered: len(desired),
	}

	owned := make(map[string]*proto.Note)
	currentByID := make(map[string]*proto.Note, len(current))
	for _, note := range current {
		if note == nil || note.GetKey() == "" {
			continue
		}
		currentByID[note.GetKey()] = note
		if noteOwnedBySource(note, sourceID) {
			owned[note.GetKey()] = note
		}
	}

	upserts := make([]*proto.Note, 0)
	for id, desiredNote := range desired {
		currentNote, exists := currentByID[id]
		if exists && !noteOwnedBySource(currentNote, sourceID) {
			return nil, fmt.Errorf("explorer source %q cannot replace unowned note %q in namespace %q", sourceID, id, namespace)
		}

		if !exists {
			result.Created++
			upserts = append(upserts, desiredNote)
			continue
		}
		if explorerNoteContentEqual(currentNote, desiredNote) {
			result.Unchanged++
			continue
		}

		result.Updated++
		upserts = append(upserts, desiredNote)
	}
	slices.SortFunc(upserts, func(a, b *proto.Note) int {
		return strings.Compare(a.GetKey(), b.GetKey())
	})

	staleIDs := make([]string, 0)
	for id := range owned {
		if _, exists := desired[id]; !exists {
			staleIDs = append(staleIDs, id)
		}
	}
	slices.Sort(staleIDs)

	if len(upserts) > 0 {
		response, err := r.client.Add(ctx, &proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Notes:     upserts,
				Namespace: namespace,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("add explorer source %q snapshot: %w", sourceID, err)
		}
		if response == nil || response.GetResponse() == nil {
			return nil, fmt.Errorf("add explorer source %q snapshot returned an empty response", sourceID)
		}
		if err := validateAddedNotes(upserts, response.GetResponse().GetNotes()); err != nil {
			return nil, fmt.Errorf("add explorer source %q snapshot: %w", sourceID, err)
		}
	}

	if len(staleIDs) > 0 {
		response, err := r.client.Delete(ctx, &proto.CartographerDeleteRequest{
			Ids:       staleIDs,
			Namespace: namespace,
		})
		if err != nil {
			return nil, fmt.Errorf("delete stale explorer source %q notes: %w", sourceID, err)
		}
		if response == nil {
			return nil, fmt.Errorf("delete stale explorer source %q notes returned an empty response", sourceID)
		}
		if len(response.GetErrors()) > 0 {
			return nil, fmt.Errorf("delete stale explorer source %q notes: %s", sourceID, strings.Join(response.GetErrors(), "; "))
		}
		if err := validateDeletedIDs(staleIDs, response.GetIds()); err != nil {
			return nil, fmt.Errorf("delete stale explorer source %q notes: %w", sourceID, err)
		}
		result.Deleted = len(staleIDs)
	}

	return result, nil
}

// runAndLog executes an interval reconciliation without terminating the polling loop on source errors.
func (r *Runner) runAndLog(ctx context.Context) {
	result, err := r.RunOnce(ctx)
	if err != nil {
		log.Errorf("Explorer reconciliation failed: %v", err)
		return
	}

	log.Infof(
		"Explorer source %s reconciled namespace %s: discovered=%d created=%d updated=%d unchanged=%d deleted=%d",
		result.SourceID,
		result.Namespace,
		result.Discovered,
		result.Created,
		result.Updated,
		result.Unchanged,
		result.Deleted,
	)
}

// getCurrentNotes retrieves the complete target namespace before reconciliation.
func (r *Runner) getCurrentNotes(ctx context.Context, namespace string) ([]*proto.Note, error) {
	response, err := r.client.Get(ctx, &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{Namespace: namespace},
		Type:    proto.RequestType_REQUEST_TYPE_DATA,
	})
	if err != nil {
		return nil, fmt.Errorf("read explorer namespace %q: %w", namespace, err)
	}
	if response == nil || response.GetResponse() == nil {
		return nil, fmt.Errorf("read explorer namespace %q returned an empty response", namespace)
	}

	return response.GetResponse().GetNotes(), nil
}

// explorerIdentity validates and normalizes the source identity exposed by an explorer.
func explorerIdentity(source Explorer) (string, string, error) {
	rawSourceID := source.SourceID()
	sourceID := strings.TrimSpace(rawSourceID)
	if sourceID == "" {
		return "", "", errors.New("explorer source ID is required")
	}
	if sourceID != rawSourceID {
		return "", "", errors.New("explorer source ID cannot have surrounding whitespace")
	}

	namespace, err := proto.GetNamespace(source.Namespace())
	if err != nil {
		return "", "", fmt.Errorf("invalid explorer namespace: %w", err)
	}

	return sourceID, namespace, nil
}

// validateAddedNotes confirms every requested upsert was acknowledged before stale deletion.
func validateAddedNotes(requested, applied []*proto.Note) error {
	appliedIDs := make(map[string]struct{}, len(applied))
	for _, note := range applied {
		if note != nil && note.GetKey() != "" {
			appliedIDs[note.GetKey()] = struct{}{}
		}
	}

	missing := make([]string, 0)
	for _, note := range requested {
		if _, exists := appliedIDs[note.GetKey()]; !exists {
			missing = append(missing, note.GetKey())
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("response did not acknowledge note IDs: %s", strings.Join(missing, ", "))
	}
	return nil
}

// validateDeletedIDs confirms every requested stale ID was acknowledged by Cartographer.
func validateDeletedIDs(requested, deleted []string) error {
	deletedSet := make(map[string]struct{}, len(deleted))
	for _, id := range deleted {
		deletedSet[id] = struct{}{}
	}

	missing := make([]string, 0)
	for _, id := range requested {
		if _, exists := deletedSet[id]; !exists {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("response did not acknowledge note IDs: %s", strings.Join(missing, ", "))
	}
	return nil
}

// prepareSnapshot clones and validates discovered notes before any remote mutation occurs.
func prepareSnapshot(notes []*proto.Note, sourceID string) (map[string]*proto.Note, error) {
	desired := make(map[string]*proto.Note, len(notes))
	for index, note := range notes {
		if note == nil {
			return nil, fmt.Errorf("explorer source %q returned a nil note at index %d", sourceID, index)
		}

		prepared := gproto.Clone(note).(*proto.Note)
		if prepared.GetKey() == "" {
			return nil, fmt.Errorf("explorer source %q returned a note without an ID at index %d", sourceID, index)
		}
		if _, exists := desired[prepared.GetKey()]; exists {
			return nil, fmt.Errorf("explorer source %q returned duplicate note ID %q", sourceID, prepared.GetKey())
		}

		if prepared.Annotations == nil {
			prepared.Annotations = make(map[string]string)
		}
		if value := prepared.Annotations[ManagedByAnnotation]; value != "" && value != ManagedByExplorer {
			return nil, fmt.Errorf("note %q has conflicting %s annotation %q", prepared.GetKey(), ManagedByAnnotation, value)
		}
		if value := prepared.Annotations[SourceIDAnnotation]; value != "" && value != sourceID {
			return nil, fmt.Errorf("note %q has conflicting %s annotation %q", prepared.GetKey(), SourceIDAnnotation, value)
		}

		prepared.Annotations[ManagedByAnnotation] = ManagedByExplorer
		prepared.Annotations[SourceIDAnnotation] = sourceID
		if prepared.GetSource() == "" {
			prepared.Source = "explorer:" + sourceID
		}

		desired[prepared.GetKey()] = prepared
	}

	return desired, nil
}

// noteOwnedBySource reports whether a stored note belongs to the specified explorer snapshot.
func noteOwnedBySource(note *proto.Note, sourceID string) bool {
	return note != nil &&
		note.GetAnnotations()[ManagedByAnnotation] == ManagedByExplorer &&
		note.GetAnnotations()[SourceIDAnnotation] == sourceID
}

// explorerNoteContentEqual compares fields the server treats as durable authored content.
func explorerNoteContentEqual(existing, desired *proto.Note) bool {
	return existing.GetId() == desired.GetId() &&
		existing.GetTitle() == desired.GetTitle() &&
		existing.GetBody() == desired.GetBody() &&
		existing.GetUrl() == desired.GetUrl() &&
		explorerTagsEqual(existing.GetTags(), desired.GetTags()) &&
		maps.Equal(existing.GetAnnotations(), desired.GetAnnotations()) &&
		gproto.Equal(existing.GetData(), desired.GetData())
}

// explorerTagsEqual compares tag slices as unordered collections.
func explorerTagsEqual(existing, desired []string) bool {
	if len(existing) != len(desired) {
		return false
	}

	existingTags := slices.Clone(existing)
	desiredTags := slices.Clone(desired)
	slices.Sort(existingTags)
	slices.Sort(desiredTags)
	return slices.Equal(existingTags, desiredTags)
}
