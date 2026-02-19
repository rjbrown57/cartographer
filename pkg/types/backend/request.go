package backend

import "github.com/rjbrown57/cartographer/pkg/log"

type BackendRequest struct {
	Key       []string // keys to operate on
	Namespace string
}

func NewBackendRequest(namespace string, keys ...string) *BackendRequest {
	if len(keys) == 0 {
		log.Fatalf("must supply at least one key")
	}
	if namespace == "" {
		log.Fatalf("namespace cannot be empty")
	}
	return &BackendRequest{
		Key:       keys,
		Namespace: namespace,
	}
}

type BackendAddRequest struct {
	Data      map[string]any
	Namespace string
}

func NewBackendAddRequest(data map[string]any, namespace string) *BackendAddRequest {
	if len(data) == 0 {
		log.Fatalf("data cannot be empty")
	}

	if namespace == "" {
		log.Fatalf("namespace cannot be empty")
	}

	return &BackendAddRequest{
		Data:      data,
		Namespace: namespace,
	}
}
