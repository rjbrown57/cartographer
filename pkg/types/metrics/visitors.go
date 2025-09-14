package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Unique visitors metrics
	UniqueVisitors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cartographer_unique_visitors_total",
			Help: "Total number of unique visitors",
		},
		[]string{"source"},
	)
)

// Track unique visitors
var (
	seenVisitors = make(map[string]bool)
	visitorMutex sync.RWMutex
)

// TrackUniqueVisitor records a unique visitor by IP address
func TrackUniqueVisitor(ip string, source string) {
	visitorMutex.Lock()
	defer visitorMutex.Unlock()

	// Check if this is a new visitor
	if !seenVisitors[ip] {
		seenVisitors[ip] = true
		UniqueVisitors.WithLabelValues(source).Inc()
	}
}

// GetUniqueVisitorCount returns the current count of unique visitors
func GetUniqueVisitorCount(source string) float64 {
	visitorMutex.RLock()
	defer visitorMutex.RUnlock()

	count := 0
	for _, seen := range seenVisitors {
		if seen {
			count++
		}
	}
	return float64(count)
}

// GetSeenVisitors returns a copy of the seen visitors map for debugging
func GetSeenVisitors() map[string]bool {
	visitorMutex.RLock()
	defer visitorMutex.RUnlock()

	visitors := make(map[string]bool)
	for ip, seen := range seenVisitors {
		visitors[ip] = seen
	}
	return visitors
}

// ClearVisitors resets the visitor tracking (useful for testing)
func ClearVisitors() {
	visitorMutex.Lock()
	defer visitorMutex.Unlock()

	seenVisitors = make(map[string]bool)
}
