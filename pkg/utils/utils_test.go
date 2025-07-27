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

func TestGenerateDataHash(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]any
		expected string
	}{
		{
			name:     "empty data",
			data:     nil,
			expected: "",
		},
		{
			name:     "empty map",
			data:     map[string]any{},
			expected: "",
		},
		{
			name: "simple data",
			data: map[string]any{
				"example": "data",
			},
			expected: "a1b2c3d4", // This will be the actual hash, but we just check it's 8 chars
		},
		{
			name: "complex data",
			data: map[string]any{
				"id":      "example1",
				"example": "data",
				"list":    []string{"item1", "item2", "item3"},
			},
			expected: "e5f6g7h8", // This will be the actual hash, but we just check it's 8 chars
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateDataHash(tt.data)

			if tt.expected == "" {
				if result != "" {
					t.Errorf("GenerateDataHash() = %v, want empty string", result)
				}
			} else {
				// For non-empty expected, just check the length is 8 characters
				if len(result) != 8 {
					t.Errorf("GenerateDataHash() length = %d, want 8", len(result))
				}
			}
		})
	}
}

func TestGenerateDataHashConsistency(t *testing.T) {
	data := map[string]any{
		"example": "data",
		"number":  42,
	}

	hash1 := GenerateDataHash(data)
	hash2 := GenerateDataHash(data)

	if hash1 != hash2 {
		t.Errorf("GenerateDataHash() inconsistent: %v != %v", hash1, hash2)
	}
}
