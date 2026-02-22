package proto

import (
	"reflect"
	"testing"
)

func TestNewProtoTag(t *testing.T) {
	tests := []struct {
		tagName     string
		description string
		expected    *Tag
	}{
		{
			tagName:     "tag1",
			description: "Tag 1",
			expected:    &Tag{Name: "tag1"},
		},
	}

	for _, test := range tests {
		result := NewProtoTag(test.tagName, test.description)
		if !reflect.DeepEqual(result, test.expected) {
			t.Errorf("NewProtoTag(%s, %s) = %v; want %v", test.tagName, test.description, result, test.expected)
		}
	}
}

func TestNewCartographerRequest(t *testing.T) {
	tests := []struct {
		links    []string
		tags     []string
		expected *CartographerRequest
	}{
		{
			links: []string{"http://example.com"},
			tags:  []string{"tag1"},
			expected: &CartographerRequest{
				Links: []*Link{
					{
						Url:         "http://example.com",
						Id:          "http://example.com",
						Displayname: "example.com",
						Tags:        []string{"tag1"},
					},
				},
				Namespace: "default",
			},
		},
	}

	for _, test := range tests {
		result, err := NewCartographerRequest(test.links, test.tags, "default")
		if err != nil {
			t.Errorf("Error building link: %s", err)
		}
		if !reflect.DeepEqual(result, test.expected) {
			t.Errorf("\nGot %v\nwant %v", result, test.expected)
		}
	}
}

// TestGetNamespace validates default namespace behavior and namespace format validation.
func TestGetNamespace(t *testing.T) {
	tests := []struct {
		name        string
		namespace   string
		expected    string
		expectError bool
	}{
		{
			name:      "empty namespace returns default",
			namespace: "",
			expected:  DefaultNamespace,
		},
		{
			name:      "valid namespace returns namespace",
			namespace: "team-a1",
			expected:  "team-a1",
		},
		{
			name:        "invalid namespace returns error",
			namespace:   "Team_A",
			expectError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := GetNamespace(test.namespace)
			if test.expectError {
				if err == nil {
					t.Errorf("GetNamespace(%q) error = nil; want non-nil", test.namespace)
				}
				return
			}

			if err != nil {
				t.Errorf("GetNamespace(%q) error = %v; want nil", test.namespace, err)
				return
			}

			if got != test.expected {
				t.Errorf("GetNamespace(%q) = %q; want %q", test.namespace, got, test.expected)
			}
		})
	}
}
