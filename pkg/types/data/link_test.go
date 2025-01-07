package data

import (
	"net/url"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func TestNewLink(t *testing.T) {

	var testLinks = []string{"http://test.com", "test.com", "https://test.com", "https://test.com:8080", "test:8080"}

	for _, linkUrl := range testLinks {
		_, err := NewLink(linkUrl)
		if err != nil {
			t.Fatalf("Failed to get URL %s - %s", linkUrl, err)
		}
	}
}

func TestSetDisplayName(t *testing.T) {
	tests := []struct {
		rawURL   string
		expected string
	}{
		{"http://test.com", "test.com"},
		{"https://test.com", "test.com"},
		{"https://test.com:8080", "test.com:8080"},
		{"ftp://test.com", "test.com"},
	}

	for _, test := range tests {
		u, err := url.Parse(test.rawURL)
		if err != nil {
			t.Fatalf("Failed to parse URL %s - %s", test.rawURL, err)
		}

		link := &Link{Link: u}
		link.SetDisplayName()

		if link.DisplayName != test.expected {
			t.Errorf("Expected display name %s, but got %s", test.expected, link.DisplayName)
		}
	}
}
func TestNewFromProtoLink(t *testing.T) {
	tests := []struct {
		protoLink *proto.Link
		expected  *Link
	}{
		{
			protoLink: &proto.Link{Url: "http://test.com", Description: "Test description"},
			expected:  &Link{Description: "Test description", DisplayName: "test.com", Link: &url.URL{Scheme: "http", Host: "test.com"}},
		},
		{
			protoLink: &proto.Link{Url: "https://test.com", Description: "Another description", Displayname: "Another display name"},
			expected:  &Link{Description: "Another description", DisplayName: "Another display name", Link: &url.URL{Scheme: "https", Host: "test.com"}},
		},
	}

	for _, test := range tests {
		link, err := NewFromProtoLink(test.protoLink)
		if err != nil {
			t.Fatalf("Failed to create link from proto link %v - %s", test.protoLink, err)
		}

		if link.Description != test.expected.Description {
			t.Errorf("Expected description %s, but got %s", test.expected.Description, link.Description)
		}

		if link.DisplayName != test.expected.DisplayName {
			t.Errorf("Expected display name %s, but got %s", test.expected.DisplayName, link.DisplayName)
		}

		if link.Link.String() != test.expected.Link.String() {
			t.Errorf("Expected URL %s, but got %s", test.expected.Link.String(), link.Link.String())
		}
	}
}
