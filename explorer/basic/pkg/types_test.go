package basic

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestNewBasicExplorerDefaults verifies stable snapshot identity defaults.
func TestNewBasicExplorerDefaults(t *testing.T) {
	explorer := NewBasicExplorer(nil)
	if got := explorer.Namespace(); got != DefaultNamespace {
		t.Fatalf("Namespace() = %q, want %q", got, DefaultNamespace)
	}
	if got := explorer.SourceID(); got != DefaultSourceID {
		t.Fatalf("SourceID() = %q, want %q", got, DefaultSourceID)
	}
}

// TestBasicExplorerDiscover verifies successful JSON responses become one deterministic note.
func TestBasicExplorerDiscover(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"name":"cartographer"}`))
	}))
	defer server.Close()

	explorer := NewBasicExplorer(&BasicExplorerOptions{
		ExplorerSourceID: "countries-api",
		TargetNamespace:  "external",
		TargetURL:        server.URL,
	})
	notes, err := explorer.Discover(context.Background())
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	if len(notes) != 1 {
		t.Fatalf("Discover() note count = %d, want 1", len(notes))
	}

	note := notes[0]
	if got := note.GetKey(); got != server.URL {
		t.Fatalf("note ID = %q, want %q", got, server.URL)
	}
	if got := note.GetAnnotations()[explorerTypeAnnotation]; got != "basic" {
		t.Fatalf("explorer annotation = %q, want basic", got)
	}
	if got := note.GetData().AsMap()["data"].(map[string]any)["name"]; got != "cartographer" {
		t.Fatalf("discovered data name = %v, want cartographer", got)
	}
}

// TestBasicExplorerDiscoverRejectsHTTPFailure verifies errors cannot become authoritative snapshots.
func TestBasicExplorerDiscoverRejectsHTTPFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		http.Error(response, "unavailable", http.StatusServiceUnavailable)
	}))
	defer server.Close()

	explorer := NewBasicExplorer(&BasicExplorerOptions{TargetURL: server.URL})
	if _, err := explorer.Discover(context.Background()); err == nil || !strings.Contains(err.Error(), "503") {
		t.Fatalf("Discover() error = %v, want HTTP status error", err)
	}
}

// TestBasicExplorerDiscoverHonorsCancellation verifies HTTP discovery stops with its context.
func TestBasicExplorerDiscoverHonorsCancellation(t *testing.T) {
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		close(requestStarted)
		<-request.Context().Done()
	}))
	defer server.Close()

	explorer := NewBasicExplorer(&BasicExplorerOptions{TargetURL: server.URL})
	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() {
		_, err := explorer.Discover(ctx)
		result <- err
	}()

	select {
	case <-requestStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("HTTP request did not start")
	}
	cancel()
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("Discover() error = nil, want cancellation error")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Discover() did not stop after cancellation")
	}
}
