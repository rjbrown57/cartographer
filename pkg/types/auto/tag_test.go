package auto

import (
	"regexp"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func TestProcessAutoTags(t *testing.T) {
	tests := []struct {
		name     string
		link     *proto.Link
		autoTags []*AutoTag
		expected []string
	}{
		{
			name: "Single match",
			link: &proto.Link{Url: "http://example.com"},
			autoTags: []*AutoTag{
				{
					Regex:       regexp.MustCompile("example"),
					RegexString: "example",
					Tags:        []string{"example-tag"},
				},
			},
			expected: []string{"example-tag"},
		},
		{
			name: "dedup validation",
			link: &proto.Link{Url: "http://example.com", Tags: []string{"example-tag"}},
			autoTags: []*AutoTag{
				{
					Regex:       regexp.MustCompile("example"),
					RegexString: "example",
					Tags:        []string{"example-tag"},
				},
			},
			expected: []string{"example-tag"},
		},
		{
			name: "Multiple matches",
			link: &proto.Link{Url: "http://example.com"},
			autoTags: []*AutoTag{
				{
					Regex:       regexp.MustCompile("example"),
					RegexString: "example",
					Tags:        []string{"example-tag"},
				},
				{
					Regex:       regexp.MustCompile("com"),
					RegexString: "com",
					Tags:        []string{"com-tag"},
				},
			},
			expected: []string{"example-tag", "com-tag"},
		},
		{
			name: "No match",
			link: &proto.Link{Url: "http://example.com"},
			autoTags: []*AutoTag{
				{
					Regex:       regexp.MustCompile("nomatch"),
					RegexString: "nomatch",
					Tags:        []string{"nomatch-tag"},
				},
			},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ProcessAutoTags(tt.link, tt.autoTags)
			if len(tt.link.Tags) != len(tt.expected) {
				t.Errorf("expected %v tags, got %v", len(tt.expected), len(tt.link.Tags))
			}
			for _, tag := range tt.expected {
				found := false
				for _, linkTag := range tt.link.Tags {
					if tag == linkTag {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected tag %v not found in link tags %v", tag, tt.link.Tags)
				}
			}
		})
	}
}

func TestConfigure(t *testing.T) {
	tests := []struct {
		name       string
		autoTag    *AutoTag
		shouldFail bool
	}{
		{
			name: "Valid regex",
			autoTag: &AutoTag{
				RegexString: "example",
				Tags:        []string{"example-tag"},
			},
			shouldFail: false,
		},
		{
			name: "Invalid regex",
			autoTag: &AutoTag{
				RegexString: "[invalid",
				Tags:        []string{"invalid-tag"},
			},
			shouldFail: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.shouldFail {
						t.Errorf("unexpected panic: %v", r)
					}
				} else {
					if tt.shouldFail {
						t.Errorf("expected panic but did not occur")
					}
				}
			}()
			tt.autoTag.Configure()
			if !tt.shouldFail && tt.autoTag.Regex == nil {
				t.Errorf("expected regex to be compiled, but it was nil")
			}
		})
	}
}
