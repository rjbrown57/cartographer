package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Backend operation counters
	CartographerObjects = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cartographer_objects",
			Help: "Current number of objects",
		},
		[]string{"type"},
	)

	BackendOperationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "cartographer_backend_operation_duration_seconds",
			Help:    "Duration of backend operations in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation"},
	)
)

// Metrics helper functions
func IncrementObjectCount(objectType string, count float64) {
	CartographerObjects.WithLabelValues(objectType).Add(count)
}

// DecrementObjectCount decrements the count of an object type
func DecrementObjectCount(objectType string, count float64) {
	CartographerObjects.WithLabelValues(objectType).Add(-count)
}

func RecordBackendOperationDuration(operation string, duration float64) {
	BackendOperationDuration.WithLabelValues(operation).Observe(duration)
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
func RecordOperationDuration(operation string) func() {
	start := time.Now()
	return func() {
		duration := time.Since(start).Seconds()
		RecordBackendOperationDuration(operation, duration)
	}
}
