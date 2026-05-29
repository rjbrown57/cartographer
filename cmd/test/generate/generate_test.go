package generatecmd

import (
	"strings"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/config"
	"gopkg.in/yaml.v3"
)

// TestBuildGeneratedNoteProducesNoteShape verifies generated records are note-like YAML.
func TestBuildGeneratedNoteProducesNoteShape(t *testing.T) {
	previousProfile := profile
	previousBodySize := bodySize
	previousURLPercent := urlPercent
	defer func() {
		profile = previousProfile
		bodySize = previousBodySize
		urlPercent = previousURLPercent
	}()

	profile = "mixed"
	bodySize = 700
	urlPercent = 100

	note := buildGeneratedNote(0)
	if note.Id == "" {
		t.Fatal("expected generated note id")
	}
	if note.Title == "" {
		t.Fatal("expected generated note title")
	}
	if !strings.Contains(note.Body, "## ") {
		t.Fatalf("expected markdown heading in generated body, got %q", note.Body)
	}
	if len(note.Tags) < 4 {
		t.Fatalf("expected generated note tags, got %v", note.Tags)
	}
	if note.URL == "" {
		t.Fatal("expected generated URL when url percent is 100")
	}

	out, err := yaml.Marshal(config.IngestConfig{
		Namespace: "generated",
		Notes:     []*config.YamlNote{note},
	})
	if err != nil {
		t.Fatalf("marshal generated config: %s", err)
	}
	if strings.Contains(string(out), "displayname:") || strings.Contains(string(out), "description:") {
		t.Fatalf("expected empty legacy fields to be omitted, got:\n%s", out)
	}
}
