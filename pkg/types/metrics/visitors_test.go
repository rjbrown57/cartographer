package metrics

import "testing"

// TestTrackUniqueVisitor verifies visitors are deduplicated by source and visitor ID.
func TestTrackUniqueVisitor(t *testing.T) {
	// Clear any existing visitors.
	ClearVisitors()

	// Track some visitors.
	TrackUniqueVisitor("visitor-a", "web-ui")
	TrackUniqueVisitor("visitor-b", "web-ui")
	TrackUniqueVisitor("visitor-a", "web-ui") // Duplicate visitor/source pair.

	// Same visitor ID on a different source is a separate visitor because the metric is source-labeled.
	TrackUniqueVisitor("visitor-a", "grpc")

	// Check unique count.
	count := GetUniqueVisitorCount()
	if count != 3 {
		t.Errorf("Expected 3 unique visitors, got %f", count)
	}

	// Check seen visitors.
	visitors := GetSeenVisitors()
	if len(visitors) != 3 {
		t.Errorf("Expected 3 seen visitors, got %d", len(visitors))
	}
}

// TestTrackUniqueVisitorInvalidInput verifies invalid tracking input does not mutate state.
func TestTrackUniqueVisitorInvalidInput(t *testing.T) {
	// Clear any existing visitors.
	ClearVisitors()

	// Invalid visitor values should be ignored.
	TrackUniqueVisitor("", "web-ui")
	TrackUniqueVisitor("visitor-a", "")

	// Verify no visitors were tracked.
	count := GetUniqueVisitorCount()
	if count != 0 {
		t.Errorf("Expected 0 unique visitors, got %f", count)
	}
}
