package metrics

import (
	"maps"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var instanceMetrics CartoMetrics
var metricsOnce sync.Once

type CartoMetrics interface {
	IncrementObjectCount(objectType, namespace string, count float64)
	DecrementObjectCount(objectType, namespace string, count float64)
	RecordOperationDuration(operation string) func()
	TrackUniqueVisitor(visitorID string, source string)
	GetUniqueVisitorCount() float64
	GetSeenVisitors() map[string]struct{}
	ClearVisitors()
}

type CartoPromMetrics struct {
	CartographerObjects      *prometheus.GaugeVec
	BackendOperationDuration *prometheus.HistogramVec
	UniqueVisitors           *prometheus.CounterVec
	seenVisitors             map[string]struct{}
	visitorMutex             sync.RWMutex
}

// Metrics returns the shared cartographer metrics singleton, initializing it on first access.
func Metrics() CartoMetrics {
	metricsOnce.Do(func() {
		instanceMetrics = &CartoPromMetrics{
			CartographerObjects: promauto.NewGaugeVec(
				prometheus.GaugeOpts{
					Name: "cartographer_objects",
					Help: "Current number of objects",
				},
				[]string{"type", "namespace"},
			),
			BackendOperationDuration: promauto.NewHistogramVec(
				prometheus.HistogramOpts{
					Name:    "cartographer_backend_operation_duration_seconds",
					Help:    "Duration of backend operations in seconds",
					Buckets: prometheus.DefBuckets,
				},
				[]string{"operation"},
			),
			UniqueVisitors: promauto.NewCounterVec(
				prometheus.CounterOpts{
					Name: "cartographer_unique_visitors_total",
					Help: "Total number of unique visitors",
				},
				[]string{"source"},
			),
			seenVisitors: make(map[string]struct{}),
		}
	})

	return instanceMetrics
}

// IncrementObjectCount increments object metrics scoped by object type and namespace.
func (c *CartoPromMetrics) IncrementObjectCount(objectType, namespace string, count float64) {
	c.CartographerObjects.WithLabelValues(objectType, namespace).Add(count)
}

// DecrementObjectCount decrements object metrics scoped by object type and namespace.
func (c *CartoPromMetrics) DecrementObjectCount(objectType, namespace string, count float64) {
	c.CartographerObjects.WithLabelValues(objectType, namespace).Add(-count)
}

func (c *CartoPromMetrics) RecordBackendOperationDuration(operation string, duration float64) {
	c.BackendOperationDuration.WithLabelValues(operation).Observe(duration)
}

// RecordOperationDuration is a helper function that returns a function to be used with defer
// to automatically record the duration of an operation.
// Usage example:
//
//	func SomeOperation() error {
//	    defer RecordOperationDuration("some_operation")()
//	    // ... operation code ...
//	    return nil
//	}
//
// This will automatically record the duration of the operation when the function returns,
// regardless of whether it returns normally or panics.
func (c *CartoPromMetrics) RecordOperationDuration(operation string) func() {
	start := time.Now()
	return func() {
		duration := time.Since(start).Seconds()
		c.RecordBackendOperationDuration(operation, duration)
	}
}

// TrackUniqueVisitor records a unique visitor by stable visitor identifier and source.
func (c *CartoPromMetrics) TrackUniqueVisitor(visitorID string, source string) {
	key, ok := visitorKey(visitorID, source)
	if !ok {
		return
	}

	c.visitorMutex.Lock()
	defer c.visitorMutex.Unlock()

	if _, ok := c.seenVisitors[key]; !ok {
		c.seenVisitors[key] = struct{}{}
		c.UniqueVisitors.WithLabelValues(source).Inc()
	}
}

// GetUniqueVisitorCount returns the current count of unique visitors.
func (c *CartoPromMetrics) GetUniqueVisitorCount() float64 {
	c.visitorMutex.RLock()
	defer c.visitorMutex.RUnlock()

	return float64(len(c.seenVisitors))
}

// GetSeenVisitors returns a copy of tracked visitors for debugging and tests.
func (c *CartoPromMetrics) GetSeenVisitors() map[string]struct{} {
	c.visitorMutex.RLock()
	defer c.visitorMutex.RUnlock()

	visitors := make(map[string]struct{})
	maps.Copy(visitors, c.seenVisitors)
	return visitors
}

// ClearVisitors resets tracked visitor state.
func (c *CartoPromMetrics) ClearVisitors() {
	c.visitorMutex.Lock()
	defer c.visitorMutex.Unlock()

	c.seenVisitors = make(map[string]struct{})
}
