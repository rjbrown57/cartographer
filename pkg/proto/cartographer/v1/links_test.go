package proto

import (
	"reflect"
	"testing"
)

func TestLinkBuilderBuildSetsDefaults(t *testing.T) {
	url := "https://www.example.com/path"
	builder := NewLinkBuilder().
		WithURL(url).
		WithDescription("desc").
		WithTags([]string{"tag1", "tag2"}).
		WithAnnotations(map[string]string{"key": "value"})

	link, err := builder.Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	if link.Id != url {
		t.Fatalf("Build() id = %q, want %q", link.Id, url)
	}
	if link.Displayname != "example.com/path" {
		t.Fatalf("Build() displayname = %q, want %q", link.Displayname, "example.com/path")
	}
	if link.Description != "desc" {
		t.Fatalf("Build() description = %q, want %q", link.Description, "desc")
	}
	if !reflect.DeepEqual(link.Tags, []string{"tag1", "tag2"}) {
		t.Fatalf("Build() tags = %v, want %v", link.Tags, []string{"tag1", "tag2"})
	}
	if !reflect.DeepEqual(link.Annotations, map[string]string{"key": "value"}) {
		t.Fatalf("Build() annotations = %v, want %v", link.Annotations, map[string]string{"key": "value"})
	}
}

func TestLinkBuilderBuildRespectsDisplayName(t *testing.T) {
	builder := NewLinkBuilder().
		WithURL("https://example.com/override").
		WithDisplayName("Custom Name")

	link, err := builder.Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	if link.Displayname != "Custom Name" {
		t.Fatalf("Build() displayname = %q, want %q", link.Displayname, "Custom Name")
	}
	if link.Id != "https://example.com/override" {
		t.Fatalf("Build() id = %q, want %q", link.Id, "https://example.com/override")
	}
}

func TestLinkBuilderBuildRequiresID(t *testing.T) {
	_, err := NewLinkBuilder().WithDescription("desc").Build()
	if err == nil {
		t.Fatalf("Build() error = nil, want non-nil")
	}
}

func TestLinkBuilderWithData(t *testing.T) {
	data := map[string]any{
		"name":  "cartographer",
		"count": 2.0,
	}
	link, err := NewLinkBuilder().WithURL("https://example.com").WithData(data).Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	if link.Data == nil {
		t.Fatalf("Build() data = nil, want non-nil")
	}
	if !reflect.DeepEqual(link.Data.AsMap(), data) {
		t.Fatalf("Build() data = %v, want %v", link.Data.AsMap(), data)
	}
}

func TestLinkBuilderWithEmptyData(t *testing.T) {
	link, err := NewLinkBuilder().WithURL("https://example.com").WithData(map[string]any{}).Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}

	if link.Data != nil {
		t.Fatalf("Build() data = %v, want nil", link.Data)
	}
}
