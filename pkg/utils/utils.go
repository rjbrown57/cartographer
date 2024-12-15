package utils

import (
	"os"

	"log"

	yaml "gopkg.in/yaml.v3"
)

func UnmarshalYaml(configPath string, v interface{}) error {
	var err error
	log.Printf("Reading %s\n", configPath)
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
