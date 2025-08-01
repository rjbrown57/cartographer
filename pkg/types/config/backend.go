package config

import (
	"github.com/rjbrown57/cartographer/pkg/backends/boltdb"
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

const (
	BoltDbDefaultPath = "/tmp/cartographer.db"
	BoltDbDefaultType = "boltdb"
)

type BackendConfig struct {
	BackendType string `yaml:"type,omitempty"`
	BackendPath string `yaml:"path,omitempty"`
}

// GetBackend returns a Backend based on the BackendConfig type key
func (b *BackendConfig) GetBackend() backend.Backend {

	switch b.BackendType {
	default:
		if b.BackendPath == "" {
			b.BackendPath = BoltDbDefaultPath
		}

		log.Infof("Using boltdb at backend path: %s", b.BackendPath)

		return boltdb.NewBoltDbBackend(&boltdb.BoltDBBackendOptions{
			Path: b.BackendPath,
		})
	}
}
