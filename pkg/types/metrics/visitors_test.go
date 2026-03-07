package metrics

import "testing"

// TestVisitorKeyTableDriven verifies visitor key construction and validation.
func TestVisitorKeyTableDriven(t *testing.T) {
	tests := []struct {
		name          string
		visitorID     string
		source        string
		expectedKey   string
		expectedValid bool
	}{
		{
			name:          "valid visitor id and source",
			visitorID:     "abc123",
			source:        "web-ui",
			expectedKey:   "web-ui|abc123",
			expectedValid: true,
		},
		{
			name:          "empty visitor id is invalid",
			visitorID:     "",
			source:        "web-ui",
			expectedKey:   "",
			expectedValid: false,
		},
		{
			name:          "empty source is invalid",
			visitorID:     "abc123",
			source:        "",
			expectedKey:   "",
			expectedValid: false,
		},
		{
			name:          "empty visitor id and source are invalid",
			visitorID:     "",
			source:        "",
			expectedKey:   "",
			expectedValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotKey, gotValid := visitorKey(tt.visitorID, tt.source)

			if gotValid != tt.expectedValid {
				t.Fatalf("expected valid %t, got %t", tt.expectedValid, gotValid)
			}

			if gotKey != tt.expectedKey {
				t.Fatalf("expected key %q, got %q", tt.expectedKey, gotKey)
			}
		})
	}
}
