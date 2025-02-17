package backend

import "github.com/rjbrown57/cartographer/pkg/log"

type BackendRequest struct {
	TypeKey string   // string name of a type of data
	Key     []string // keys within the string
}

func NewBackendRequest(typeKey string, keys ...string) *BackendRequest {
	if len(keys) == 0 || typeKey == "" {
		log.Fatalf("must supply key/typekey")
	}
	return &BackendRequest{
		Key:     keys,
		TypeKey: typeKey,
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
