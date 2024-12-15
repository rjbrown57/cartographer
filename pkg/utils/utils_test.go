package utils

import (
	"os"
	"testing"
)

type ExampleStruct struct {
	Key1 string `yaml:"key1"`
	Key2 string `yaml:"key2"`
}

var ExampleContent string = `
key1: value1
key2: value2
`

func TestMustUnmarshalYaml(t *testing.T) {
	// Create a temporary YAML file for testing
	tempFile, err := os.CreateTemp("", "test*.yaml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tempFile.Name())

	if _, err := tempFile.Write([]byte(ExampleContent)); err != nil {
		t.Fatalf("Failed to write to temp file: %v", err)
	}

	tempFile.Close()

	var config ExampleStruct

	err = UnmarshalYaml(tempFile.Name(), &config)
	if err != nil {
		t.Fatalf("Failed to unmarshal YAML: %v", err)
	}

	if config.Key1 != "value1" || config.Key2 != "value2" {
		t.Errorf("Unmarshaled content does not match expected values: %+v", config)
	}
}
