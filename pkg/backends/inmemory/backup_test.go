package inmemory

import (
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/config"
)

func TestExport(t *testing.T) {
	i := PrepTest(t)

	c := i.Export()

	// Should be updated to check the values
	if len(c.Groups) != 1 {
		t.Fatalf("Groups not populated appropriately : got %d : want %d", len(c.Groups), 1)
	}

	if len(c.Links) != 2 {
		t.Fatalf("Groups not populated appropriately : got %d : want %d", len(c.Links), 2)
	}
}

func TestBackup(t *testing.T) {

	// Create and initialize backend based on common testconfig
	i := PrepTest(t)

	// Perform the backup
	err := i.Backup()
	if err != nil {
		t.Fatalf("Failed to backup InMemoryBackend - %s", err)
	}

	// Set a new config based only on the info provided in the backup
	bc := config.NewCartographerConfig(i.backupConfig.BackupPath)
	bi := NewInMemoryBackend(&bc.ServerConfig.BackupConfig)

	// Initialize the new backend
	err = bi.Initialize(bc)
	if err != nil {
		t.Fatalf("Failed to initialize InMemoryBackend")
	}

	// Compare the two backends... if you squint
	// At some point I need to write a function to resolve a Map of pointers to a Map of values,
	// Then we can compare those
	if len(i.Groups) != len(bi.Groups) {
		t.Fatalf("Groups not populated appropriately : got %d : want %d", len(bi.Groups), len(i.Groups))
	}
	if len(i.Links) != len(bi.Links) {
		t.Fatalf("Links not populated appropriately : got %d : want %d", len(bi.Links), len(i.Links))
	}
}
