package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"

	"github.com/rjbrown57/cartographer/pkg/log"

	yaml "gopkg.in/yaml.v3"
)

func UnmarshalYaml(configPath string, v any) error {
	var err error
	log.Infof("Reading %s\n", configPath)
	// #nosec G304
	yamlFile, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	return yaml.Unmarshal(yamlFile, v)
}

func Contains(needle string, haystack []string) bool {
	for _, item := range haystack {
		if item == needle {
			return true
		}
	}
	return false
}

// GenerateDataHash generates a short unique string based on the data field content
// It creates a SHA256 hash of the JSON representation of the data and returns the first 8 characters
func GenerateDataHash(data map[string]any) string {
	if len(data) == 0 {
		return ""
	}

	// Convert data to JSON for consistent hashing
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Errorf("Failed to marshal data to JSON: %v", err)
		return ""
	}

	// Create SHA256 hash
	hash := sha256.Sum256(jsonData)

	// Return first 8 characters of hex representation
	return hex.EncodeToString(hash[:])[:8]
}
