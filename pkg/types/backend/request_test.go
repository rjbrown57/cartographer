package backend

import (
	"reflect"
	"testing"
)

func TestNewBackendRequest(t *testing.T) {
	tests := []struct {
		name string
		keys []string
		want *BackendRequest
	}{
		{
			name: "single key",
			keys: []string{"key1"},
			want: &BackendRequest{
				Key: []string{"key1"},
			},
		},
		{
			name: "multiple keys",
			keys: []string{"key1", "key2"},
			want: &BackendRequest{
				Key: []string{"key1", "key2"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NewBackendRequest(tt.keys...); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("NewBackendRequest() = %v, want %v", got, tt.want)
			}
		})
	}
}
