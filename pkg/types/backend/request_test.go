package backend

import (
	"reflect"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
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
				Key:       []string{"key1"},
				Namespace: proto.DefaultNamespace,
			},
		},
		{
			name: "multiple keys",
			keys: []string{"key1", "key2"},
			want: &BackendRequest{
				Key:       []string{"key1", "key2"},
				Namespace: proto.DefaultNamespace,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NewBackendRequest("default", tt.keys...); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("NewBackendRequest() = %v, want %v", got, tt.want)
			}
		})
	}
}
