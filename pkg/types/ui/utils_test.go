package ui

import "testing"

func TestSplitQueryArray(t *testing.T) {
	tests := []struct {
		name     string
		in       []string
		expected []string
	}{
		{
			name:     "basic mixed single and comma-separated",
			in:       []string{"oci,k8s", "gitlab", "oci"},
			expected: []string{"oci", "k8s", "gitlab", "oci"},
		},
		{
			name:     "single value",
			in:       []string{"oci"},
			expected: []string{"oci"},
		},
		{
			name:     "multiple commas",
			in:       []string{"a,b,c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "empty input returns nil slice",
			in:       nil,
			expected: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := SplitQueryArray(tc.in)

			if len(got) != len(tc.expected) {
				t.Fatalf("%s: length mismatch: expected %d, got %d (got=%v)", tc.name, len(tc.expected), len(got), got)
			}
			for i := range got {
				if got[i] != tc.expected[i] {
					t.Fatalf("%s: index %d: expected %q, got %q (full=%v)", tc.name, i, tc.expected[i], got[i], got)
				}
			}
		})
	}
}
