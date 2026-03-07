package metrics

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

// newTestMetrics creates an isolated metrics instance for tests.
func newTestMetrics() *CartoPromMetrics {
	return &CartoPromMetrics{
		CartographerObjects: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "test_cartographer_objects",
				Help: "Current number of objects for tests",
			},
			[]string{"type", "namespace"},
		),
		BackendOperationDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "test_backend_operation_duration_seconds",
				Help:    "Duration of backend operations in seconds for tests",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"operation"},
		),
		UniqueVisitors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_unique_visitors_total",
				Help: "Total number of unique visitors for tests",
			},
			[]string{"source"},
		),
		seenVisitors: make(map[string]struct{}),
	}
}

// histogramSampleCount returns the observed sample count for one operation label.
func histogramSampleCount(t *testing.T, h *prometheus.HistogramVec, operation string) uint64 {
	t.Helper()

	ch := make(chan prometheus.Metric, 16)
	h.Collect(ch)
	close(ch)

	for collectedMetric := range ch {
		metric := &dto.Metric{}
		if err := collectedMetric.Write(metric); err != nil {
			t.Fatalf("failed writing histogram metric: %v", err)
		}

		for _, label := range metric.GetLabel() {
			if label.GetName() == "operation" && label.GetValue() == operation {
				return metric.GetHistogram().GetSampleCount()
			}
		}
	}

	return 0
}

// gaugeValue returns the current value for one gauge label set.
func gaugeValue(t *testing.T, g *prometheus.GaugeVec, objectType string, namespace string) float64 {
	t.Helper()

	metric := &dto.Metric{}
	if err := g.WithLabelValues(objectType, namespace).Write(metric); err != nil {
		t.Fatalf("failed writing gauge metric: %v", err)
	}

	return metric.GetGauge().GetValue()
}

// TestTrackUniqueVisitorTableDriven verifies unique visitor de-duplication behavior.
func TestTrackUniqueVisitorTableDriven(t *testing.T) {
	type visitorInput struct {
		visitorID string
		source    string
	}

	tests := []struct {
		name          string
		inputs        []visitorInput
		expectedCount float64
		expectedSeen  map[string]struct{}
	}{
		{
			name: "tracks one valid visitor",
			inputs: []visitorInput{
				{visitorID: "a", source: "web-ui"},
			},
			expectedCount: 1,
			expectedSeen: map[string]struct{}{
				"web-ui|a": {},
			},
		},
		{
			name: "deduplicates same visitor and source",
			inputs: []visitorInput{
				{visitorID: "a", source: "web-ui"},
				{visitorID: "a", source: "web-ui"},
			},
			expectedCount: 1,
			expectedSeen: map[string]struct{}{
				"web-ui|a": {},
			},
		},
		{
			name: "same visitor across sources is unique per source",
			inputs: []visitorInput{
				{visitorID: "a", source: "web-ui"},
				{visitorID: "a", source: "api"},
			},
			expectedCount: 2,
			expectedSeen: map[string]struct{}{
				"web-ui|a": {},
				"api|a":    {},
			},
		},
		{
			name: "ignores invalid visitor identifiers",
			inputs: []visitorInput{
				{visitorID: "", source: "web-ui"},
				{visitorID: "a", source: ""},
				{visitorID: "", source: ""},
			},
			expectedCount: 0,
			expectedSeen:  map[string]struct{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMetrics()

			for _, in := range tt.inputs {
				m.TrackUniqueVisitor(in.visitorID, in.source)
			}

			if got := m.GetUniqueVisitorCount(); got != tt.expectedCount {
				t.Fatalf("expected unique visitor count %f, got %f", tt.expectedCount, got)
			}

			if got := m.GetSeenVisitors(); len(got) != len(tt.expectedSeen) {
				t.Fatalf("expected seen map size %d, got %d", len(tt.expectedSeen), len(got))
			} else {
				for key := range tt.expectedSeen {
					if _, ok := got[key]; !ok {
						t.Fatalf("expected seen key %q to be present", key)
					}
				}
			}
		})
	}
}

// TestGetSeenVisitorsTableDriven verifies returned visitor maps are copied.
func TestGetSeenVisitorsTableDriven(t *testing.T) {
	tests := []struct {
		name             string
		seedVisitorID    string
		seedSource       string
		mutatedKey       string
		expectedHasAfter bool
	}{
		{
			name:             "mutating returned map does not mutate internal map",
			seedVisitorID:    "seed",
			seedSource:       "web-ui",
			mutatedKey:       "external|mutation",
			expectedHasAfter: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMetrics()
			m.TrackUniqueVisitor(tt.seedVisitorID, tt.seedSource)

			snapshot := m.GetSeenVisitors()
			snapshot[tt.mutatedKey] = struct{}{}

			after := m.GetSeenVisitors()
			_, has := after[tt.mutatedKey]
			if has != tt.expectedHasAfter {
				t.Fatalf("expected mutated key presence to be %t, got %t", tt.expectedHasAfter, has)
			}
		})
	}
}

// TestClearVisitorsTableDriven verifies visitor state is reset.
func TestClearVisitorsTableDriven(t *testing.T) {
	tests := []struct {
		name      string
		seedCount int
	}{
		{
			name:      "clears populated visitor state",
			seedCount: 2,
		},
		{
			name:      "clear on empty visitor state is safe",
			seedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMetrics()

			for i := 0; i < tt.seedCount; i++ {
				m.TrackUniqueVisitor("visitor-"+string(rune('a'+i)), "web-ui")
			}

			m.ClearVisitors()

			if got := m.GetUniqueVisitorCount(); got != 0 {
				t.Fatalf("expected unique visitor count 0 after clear, got %f", got)
			}

			if got := len(m.GetSeenVisitors()); got != 0 {
				t.Fatalf("expected seen visitor map size 0 after clear, got %d", got)
			}
		})
	}
}

// TestObjectCountTableDriven verifies increment/decrement semantics for object gauges.
func TestObjectCountTableDriven(t *testing.T) {
	tests := []struct {
		name       string
		objectType string
		namespace  string
		inc        float64
		dec        float64
		expected   float64
	}{
		{
			name:       "increment then decrement",
			objectType: "link",
			namespace:  "default",
			inc:        3,
			dec:        1,
			expected:   2,
		},
		{
			name:       "decrement exactly to zero",
			objectType: "searchIndexCount",
			namespace:  "k8s",
			inc:        5,
			dec:        5,
			expected:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMetrics()

			m.IncrementObjectCount(tt.objectType, tt.namespace, tt.inc)
			m.DecrementObjectCount(tt.objectType, tt.namespace, tt.dec)

			if got := gaugeValue(t, m.CartographerObjects, tt.objectType, tt.namespace); got != tt.expected {
				t.Fatalf("expected gauge value %f, got %f", tt.expected, got)
			}
		})
	}
}

// TestRecordOperationDurationTableDriven verifies deferred operation timing records observations.
func TestRecordOperationDurationTableDriven(t *testing.T) {
	tests := []struct {
		name           string
		operation      string
		repetitions    int
		sleepPerRecord time.Duration
	}{
		{
			name:           "records one observation",
			operation:      "get",
			repetitions:    1,
			sleepPerRecord: 1 * time.Millisecond,
		},
		{
			name:           "records multiple observations",
			operation:      "add",
			repetitions:    3,
			sleepPerRecord: 1 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMetrics()

			for i := 0; i < tt.repetitions; i++ {
				done := m.RecordOperationDuration(tt.operation)
				time.Sleep(tt.sleepPerRecord)
				done()
			}

			if got := histogramSampleCount(t, m.BackendOperationDuration, tt.operation); got != uint64(tt.repetitions) {
				t.Fatalf("expected histogram sample count %d, got %d", tt.repetitions, got)
			}
		})
	}
}
