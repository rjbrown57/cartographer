package backend

import "github.com/rjbrown57/cartographer/pkg/log"

type BackendRequest struct {
	Key []string // keys to operate on
}

func NewBackendRequest(keys ...string) *BackendRequest {
	if len(keys) == 0 {
		log.Fatalf("must supply at least one key")
	}
	return &BackendRequest{
		Key: keys,
	}
}

type BackendAddRequest struct {
	Data map[string]interface{}
}

func NewBackendAddRequest(data map[string]interface{}) *BackendAddRequest {
	if len(data) == 0 {
		log.Fatalf("data cannot be empty")
	}
	return &BackendAddRequest{
		Data: data,
	}
}
