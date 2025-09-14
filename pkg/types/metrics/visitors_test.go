package metrics

import (
	"testing"
)

func TestTrackUniqueVisitor(t *testing.T) {
	// Clear any existing visitors
	ClearVisitors()

	// Track some visitors
	TrackUniqueVisitor("192.168.1.1", "web-ui")
	TrackUniqueVisitor("192.168.1.2", "web-ui")
	TrackUniqueVisitor("192.168.1.1", "web-ui") // Duplicate IP

	// Check unique count
	count := GetUniqueVisitorCount("web-ui")
	if count != 2 {
		t.Errorf("Expected 2 unique visitors, got %f", count)
	}

	// Check seen visitors
	visitors := GetSeenVisitors()
	if len(visitors) != 2 {
		t.Errorf("Expected 2 seen visitors, got %d", len(visitors))
	}
}
