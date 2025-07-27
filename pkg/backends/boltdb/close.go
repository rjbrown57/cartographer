package boltdb

import "github.com/rjbrown57/cartographer/pkg/log"

func (b *BoltDBBackend) Close() error {
	log.Debugf("Closing BoltDB backend")
	return b.db.Close()
}
