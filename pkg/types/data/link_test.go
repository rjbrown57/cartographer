package data

import "testing"

func TestNewLink(t *testing.T) {

	var testLinks = []string{"http://test.com", "test.com", "https://test.com", "https://test.com:8080", "test:8080"}

	for _, linkUrl := range testLinks {
		_, err := NewLink(linkUrl)
		if err != nil {
			t.Fatalf("Failed to get URL %s - %s", linkUrl, err)
		}
	}
}
