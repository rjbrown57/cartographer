package inmemory

import (
	"testing"

	. "github.com/rjbrown57/cartographer/pkg/types/backend"
)

func TestBackendInterface(t *testing.T) {
	// Ensure that InMemoryBackend implements the Backend interface
	var _ Backend = &InMemoryBackend{}
}
