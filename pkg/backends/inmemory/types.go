package inmemory

import (
	"sync"
)

type InMemoryBackend struct {
	Data sync.Map
}

func NewInMemoryBackend() *InMemoryBackend {
	i := &InMemoryBackend{
		Data: sync.Map{},
	}

	return i
}
