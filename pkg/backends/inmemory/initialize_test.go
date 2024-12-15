package inmemory

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

func PrepTest(t *testing.T) *InMemoryBackend {

	configFile, err := utils.WriteTestConfig()
	if err != nil {
		t.Fatalf("Failed to write test config %s", err)
	}

	c := config.NewCartographerConfig(configFile.Name())

	t.Cleanup(func() {
		configFile.Close()
		os.Remove(configFile.Name())
		os.Remove(c.ServerConfig.BackupConfig.BackupPath)
	})

	i := NewInMemoryBackend(&c.ServerConfig.BackupConfig)

	err = i.Initialize(c)
	if err != nil {
		t.Fatalf("Failed to initialize InMemoryBackend")
	}

	return i
}

func TestInitialize(t *testing.T) {

	i := PrepTest(t)

	// Should be updated to check the values
	if len(i.Groups) != 1 {
		t.Fatalf("Groups not populated appropriately : got %d : want %d", len(i.Groups), 1)
	}

	if len(i.Links) != 2 {
		t.Fatalf("Links not populated appropriately : got %d : want %d", len(i.Links), 2)
	}

	if len(i.Tags) != 2 {
		t.Fatalf("Tags not populated appropriately : got %d : want %d", len(i.Tags), 2)
	}
}
