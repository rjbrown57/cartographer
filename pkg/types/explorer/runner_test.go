package explorer

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
	gproto "google.golang.org/protobuf/proto"
)

// fakeExplorer provides controlled snapshots and errors to runner tests.
type fakeExplorer struct {
	sourceID  string
	namespace string
	discover  func(context.Context) ([]*proto.Note, error)
}

// SourceID returns the fake explorer ownership identity.
func (f *fakeExplorer) SourceID() string {
	return f.sourceID
}

// Namespace returns the fake explorer target namespace.
func (f *fakeExplorer) Namespace() string {
	return f.namespace
}

// Discover delegates discovery to the test callback.
func (f *fakeExplorer) Discover(ctx context.Context) ([]*proto.Note, error) {
	return f.discover(ctx)
}

// fakeCartographerClient stores notes in memory and records reconciliation calls.
type fakeCartographerClient struct {
	mu                     sync.Mutex
	notes                  map[string]*proto.Note
	getCalls               int
	addCalls               int
	deleteCalls            int
	addedIDs               []string
	deletedIDs             []string
	addErr                 error
	deleteErr              error
	omitAddAcknowledgement bool
}

// newFakeCartographerClient creates an in-memory client from the supplied notes.
func newFakeCartographerClient(notes ...*proto.Note) *fakeCartographerClient {
	client := &fakeCartographerClient{notes: make(map[string]*proto.Note)}
	for _, note := range notes {
		client.notes[note.GetKey()] = gproto.Clone(note).(*proto.Note)
	}
	return client
}

// Get returns a clone of the current in-memory namespace snapshot.
func (f *fakeCartographerClient) Get(_ context.Context, _ *proto.CartographerGetRequest, _ ...grpc.CallOption) (*proto.CartographerGetResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.getCalls++
	notes := make([]*proto.Note, 0, len(f.notes))
	for _, note := range f.notes {
		notes = append(notes, gproto.Clone(note).(*proto.Note))
	}
	return &proto.CartographerGetResponse{
		Response: &proto.CartographerResponse{Notes: notes},
	}, nil
}

// Add records and applies one in-memory batch unless an add error is configured.
func (f *fakeCartographerClient) Add(_ context.Context, request *proto.CartographerAddRequest, _ ...grpc.CallOption) (*proto.CartographerAddResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.addCalls++
	if f.addErr != nil {
		return nil, f.addErr
	}

	added := make([]*proto.Note, 0, len(request.GetRequest().GetNotes()))
	for _, note := range request.GetRequest().GetNotes() {
		cloned := gproto.Clone(note).(*proto.Note)
		f.notes[note.GetKey()] = cloned
		f.addedIDs = append(f.addedIDs, note.GetKey())
		if !f.omitAddAcknowledgement {
			added = append(added, cloned)
		}
	}
	return &proto.CartographerAddResponse{
		Response: &proto.CartographerResponse{Notes: added},
	}, nil
}

// Delete records and applies one in-memory deletion batch unless an error is configured.
func (f *fakeCartographerClient) Delete(_ context.Context, request *proto.CartographerDeleteRequest, _ ...grpc.CallOption) (*proto.CartographerDeleteResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.deleteCalls++
	if f.deleteErr != nil {
		return nil, f.deleteErr
	}

	for _, id := range request.GetIds() {
		delete(f.notes, id)
		f.deletedIDs = append(f.deletedIDs, id)
	}
	return &proto.CartographerDeleteResponse{Ids: slices.Clone(request.GetIds())}, nil
}

// TestRunnerReconcilesOwnedSnapshot verifies creation, updates, no-ops, and ownership-safe deletion.
func TestRunnerReconcilesOwnedSnapshot(t *testing.T) {
	const sourceID = "docs"
	client := newFakeCartographerClient(
		ownedTestNote("keep", "same", sourceID),
		ownedTestNote("update", "old", sourceID),
		ownedTestNote("stale", "remove", sourceID),
		&proto.Note{Id: "manual", Body: "preserve"},
		ownedTestNote("other", "preserve", "another-source"),
	)
	discovered := []*proto.Note{
		{Id: "keep", Body: "same", Tags: []string{"b", "a"}, Annotations: map[string]string{"kind": "test"}},
		{Id: "update", Body: "new", Tags: []string{"a", "b"}, Annotations: map[string]string{"kind": "test"}},
		{Id: "create", Body: "new", Annotations: map[string]string{"kind": "test"}},
	}

	runner, err := NewRunner(RunnerOptions{
		Explorer: &fakeExplorer{
			sourceID:  sourceID,
			namespace: "docs",
			discover: func(context.Context) ([]*proto.Note, error) {
				return discovered, nil
			},
		},
		Client: client,
	})
	if err != nil {
		t.Fatalf("NewRunner() error = %v", err)
	}

	result, err := runner.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if result.Discovered != 3 || result.Created != 1 || result.Updated != 1 || result.Unchanged != 1 || result.Deleted != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if got, want := client.addedIDs, []string{"create", "update"}; !slices.Equal(got, want) {
		t.Fatalf("added IDs = %v, want %v", got, want)
	}
	if got, want := client.deletedIDs, []string{"stale"}; !slices.Equal(got, want) {
		t.Fatalf("deleted IDs = %v, want %v", got, want)
	}
	if _, exists := client.notes["manual"]; !exists {
		t.Fatal("manual note was deleted")
	}
	if _, exists := client.notes["other"]; !exists {
		t.Fatal("differently owned note was deleted")
	}
	created := client.notes["create"]
	if !noteOwnedBySource(created, sourceID) {
		t.Fatalf("created note missing ownership annotations: %v", created.GetAnnotations())
	}
	if got := created.GetSource(); got != "explorer:"+sourceID {
		t.Fatalf("created note source = %q, want %q", got, "explorer:"+sourceID)
	}
}

// TestRunnerRejectsUnownedIDCollision verifies reconciliation cannot overwrite a manual note.
func TestRunnerRejectsUnownedIDCollision(t *testing.T) {
	client := newFakeCartographerClient(&proto.Note{Id: "shared", Body: "manual"})
	runner := mustTestRunner(t, client, []*proto.Note{{Id: "shared", Body: "explorer"}})

	_, err := runner.RunOnce(context.Background())
	if err == nil || !strings.Contains(err.Error(), "cannot replace unowned note") {
		t.Fatalf("RunOnce() error = %v, want unowned collision", err)
	}
	if client.addCalls != 0 || client.deleteCalls != 0 {
		t.Fatalf("collision mutated remote state: add=%d delete=%d", client.addCalls, client.deleteCalls)
	}
}

// TestRunnerDiscoveryFailureDoesNotReadOrMutate verifies discovery errors stop reconciliation immediately.
func TestRunnerDiscoveryFailureDoesNotReadOrMutate(t *testing.T) {
	client := newFakeCartographerClient(ownedTestNote("stale", "body", "docs"))
	runner, err := NewRunner(RunnerOptions{
		Explorer: &fakeExplorer{
			sourceID:  "docs",
			namespace: "docs",
			discover: func(context.Context) ([]*proto.Note, error) {
				return nil, errors.New("upstream unavailable")
			},
		},
		Client: client,
	})
	if err != nil {
		t.Fatalf("NewRunner() error = %v", err)
	}

	if _, err := runner.RunOnce(context.Background()); err == nil {
		t.Fatal("RunOnce() error = nil, want discovery error")
	}
	if client.getCalls != 0 || client.addCalls != 0 || client.deleteCalls != 0 {
		t.Fatalf("discovery failure called client: get=%d add=%d delete=%d", client.getCalls, client.addCalls, client.deleteCalls)
	}
}

// TestRunnerValidationFailureDoesNotReadOrMutate verifies invalid snapshots fail before remote calls.
func TestRunnerValidationFailureDoesNotReadOrMutate(t *testing.T) {
	client := newFakeCartographerClient()
	runner := mustTestRunner(t, client, []*proto.Note{{Id: "duplicate"}, {Id: "duplicate"}})

	if _, err := runner.RunOnce(context.Background()); err == nil || !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("RunOnce() error = %v, want duplicate ID error", err)
	}
	if client.getCalls != 0 || client.addCalls != 0 || client.deleteCalls != 0 {
		t.Fatalf("validation failure called client: get=%d add=%d delete=%d", client.getCalls, client.addCalls, client.deleteCalls)
	}
}

// TestRunnerAddFailurePreventsStaleDeletion verifies failed upserts retain the previous snapshot.
func TestRunnerAddFailurePreventsStaleDeletion(t *testing.T) {
	client := newFakeCartographerClient(ownedTestNote("stale", "body", "docs"))
	client.addErr = errors.New("backend unavailable")
	runner := mustTestRunner(t, client, []*proto.Note{{Id: "new", Body: "body"}})

	if _, err := runner.RunOnce(context.Background()); err == nil {
		t.Fatal("RunOnce() error = nil, want add error")
	}
	if client.deleteCalls != 0 {
		t.Fatalf("add failure performed %d delete calls", client.deleteCalls)
	}
	if _, exists := client.notes["stale"]; !exists {
		t.Fatal("stale note was deleted after add failure")
	}
}

// TestRunnerMissingAddAcknowledgementPreventsStaleDeletion verifies partial Add responses are treated as failures.
func TestRunnerMissingAddAcknowledgementPreventsStaleDeletion(t *testing.T) {
	client := newFakeCartographerClient(ownedTestNote("stale", "body", "docs"))
	client.omitAddAcknowledgement = true
	runner := mustTestRunner(t, client, []*proto.Note{{Id: "new", Body: "body"}})

	if _, err := runner.RunOnce(context.Background()); err == nil || !strings.Contains(err.Error(), "did not acknowledge") {
		t.Fatalf("RunOnce() error = %v, want missing acknowledgement error", err)
	}
	if client.deleteCalls != 0 {
		t.Fatalf("unacknowledged add performed %d delete calls", client.deleteCalls)
	}
	if _, exists := client.notes["stale"]; !exists {
		t.Fatal("stale note was deleted after unacknowledged add")
	}
}

// TestRunnerIntervalStopsOnCancellation verifies polling exits cleanly through context cancellation.
func TestRunnerIntervalStopsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	client := newFakeCartographerClient()
	discoveries := 0
	runner, err := NewRunner(RunnerOptions{
		Explorer: &fakeExplorer{
			sourceID:  "docs",
			namespace: "docs",
			discover: func(context.Context) ([]*proto.Note, error) {
				discoveries++
				if discoveries == 2 {
					cancel()
				}
				return []*proto.Note{}, nil
			},
		},
		Client:   client,
		Interval: time.Millisecond,
	})
	if err != nil {
		t.Fatalf("NewRunner() error = %v", err)
	}

	if err := runner.Run(ctx); err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if discoveries < 2 {
		t.Fatalf("discoveries = %d, want at least 2", discoveries)
	}
}

// mustTestRunner creates a default docs runner or fails the current test.
func mustTestRunner(t *testing.T, client CartographerClient, notes []*proto.Note) *Runner {
	t.Helper()
	runner, err := NewRunner(RunnerOptions{
		Explorer: &fakeExplorer{
			sourceID:  "docs",
			namespace: "docs",
			discover: func(context.Context) ([]*proto.Note, error) {
				return notes, nil
			},
		},
		Client: client,
	})
	if err != nil {
		t.Fatalf("NewRunner() error = %v", err)
	}
	return runner
}

// ownedTestNote creates a stored note with runner ownership and stable comparison fields.
func ownedTestNote(id, body, sourceID string) *proto.Note {
	return &proto.Note{
		Id:   id,
		Body: body,
		Tags: []string{"a", "b"},
		Annotations: map[string]string{
			ManagedByAnnotation: ManagedByExplorer,
			SourceIDAnnotation:  sourceID,
			"kind":              "test",
		},
		Source: "explorer:" + sourceID,
	}
}
