package metrics

import (
	"fmt"
	"maps"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// UniqueVisitors tracks unique visitor events by source.
	UniqueVisitors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cartographer_unique_visitors_total",
			Help: "Total number of unique visitors",
		},
		[]string{"source"},
	)
)

// Track unique visitors.
var (
	seenVisitors = make(map[string]bool)
	visitorMutex sync.RWMutex
)

// visitorKey builds the de-duplication key for a visitor identifier/source pair.
func visitorKey(visitorID string, source string) (string, bool) {
	if visitorID == "" || source == "" {
		return "", false
	}

	return fmt.Sprintf("%s|%s", source, visitorID), true
}

// TrackUniqueVisitor records a unique visitor by stable visitor identifier.
func TrackUniqueVisitor(visitorID string, source string) {
	key, ok := visitorKey(visitorID, source)
	if !ok {
		return
	}

	visitorMutex.Lock()
	defer visitorMutex.Unlock()

	// The counter is labeled by source, so deduplication must include source.
	if !seenVisitors[key] {
		seenVisitors[key] = true
		UniqueVisitors.WithLabelValues(source).Inc()
	}
}

// GetUniqueVisitorCount returns the current count of unique visitors.
func GetUniqueVisitorCount() float64 {
	visitorMutex.RLock()
	defer visitorMutex.RUnlock()

	// Since all values in seenVisitors are true, the map length equals the count.
	return float64(len(seenVisitors))
}

// GetSeenVisitors returns a copy of the seen visitors map for debugging.
func GetSeenVisitors() map[string]bool {
	visitorMutex.RLock()
	defer visitorMutex.RUnlock()

	visitors := make(map[string]bool)
	maps.Copy(visitors, seenVisitors)
	return visitors
}

// ClearVisitors resets the visitor tracking (useful for testing).
func ClearVisitors() {
	visitorMutex.Lock()
	defer visitorMutex.Unlock()

	seenVisitors = make(map[string]bool)
}
