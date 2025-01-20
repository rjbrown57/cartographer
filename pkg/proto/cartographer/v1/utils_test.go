package proto

import (
	"reflect"
	"testing"
)

func TestNewProtoLink(t *testing.T) {
	tests := []struct {
		link        string
		description string
		displayName string
		tags        []string
		expected    *Link
	}{
		{
			link:        "http://example.com",
			description: "Example",
			displayName: "Example",
			tags:        []string{"tag1", "tag2"},
			expected:    &Link{Url: "http://example.com", Description: "Example", Displayname: "Example", Tags: []string{"tag1", "tag2"}},
		},
		{
			link:        "http://example.com",
			description: "Example",
			displayName: "",
			tags:        []string{"tag1", "tag2"},
			expected:    &Link{Url: "http://example.com", Description: "Example", Displayname: "http://example.com", Tags: []string{"tag1", "tag2"}},
		},
	}

	for _, test := range tests {
		result := NewProtoLink(test.link, test.description, test.displayName, test.tags)
		if !reflect.DeepEqual(result, test.expected) {
			t.Errorf("NewProtoLink(%s, %s, %s, %v) = %v; want %v", test.link, test.description, test.displayName, test.tags, result, test.expected)
		}
	}
}

func TestNewProtoGroup(t *testing.T) {
	tests := []struct {
		groupName   string
		tags        []*Tag
		description string
		expected    *Group
	}{
		{
			groupName:   "group1",
			tags:        []*Tag{},
			description: "Group 1",
			expected:    &Group{Name: "group1", Tags: []string{}, Description: "Group 1"},
		},
	}

	for _, test := range tests {
		result := NewProtoGroup(test.groupName, test.tags, test.description)
		if !reflect.DeepEqual(result, test.expected) {
			t.Errorf("NewProtoGroup(%s, %v, %s) = %v; want %v", test.groupName, test.tags, test.description, result, test.expected)
		}
	}
}

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
		links       []string
		tags        []string
		groups      []string
		requestType RequestType
		expected    *CartographerRequest
	}{
		{
			links:       []string{"http://example.com"},
			tags:        []string{"tag1"},
			groups:      []string{"group1"},
			requestType: 0,
			expected: &CartographerRequest{
				Links:  []*Link{NewProtoLink("http://example.com", "", "", []string{"tag1"})},
				Tags:   []*Tag{NewProtoTag("tag1", "")},
				Groups: []*Group{NewProtoGroup("group1", []*Tag{NewProtoTag("tag1", "")}, "")},
			},
		},
	}

	for _, test := range tests {
		result := NewCartographerRequest(test.links, test.tags, test.groups)
		if !reflect.DeepEqual(result, test.expected) {
			t.Errorf("NewCartographerRequest(%v, %v, %v, %v) = %v; want %v", test.links, test.tags, test.groups, test.requestType, result, test.expected)
		}
	}
}
