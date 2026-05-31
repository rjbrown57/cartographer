package generatecmd

import (
	"os"
	"path/filepath"
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

	note := buildGeneratedNote(0, "generated")
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
	if !strings.Contains(note.Id, "generated") {
		t.Fatalf("expected namespace in generated id, got %q", note.Id)
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

// TestGetSelectedNamespaces verifies comma-separated namespace normalization.
func TestGetSelectedNamespaces(t *testing.T) {
	previousNamespace := namespace
	previousNamespaces := namespaces
	defer func() {
		namespace = previousNamespace
		namespaces = previousNamespaces
	}()

	namespace = "default"
	namespaces = "default, platform,security, platform"

	got := getSelectedNamespaces()
	want := []string{"default", "platform", "security"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("expected namespaces %v, got %v", want, got)
	}
}

// TestWriteGeneratedNamespaceFiles verifies directory output writes one file per namespace.
func TestWriteGeneratedNamespaceFiles(t *testing.T) {
	previousNum := num
	previousOutputDir := outputDir
	previousURLPercent := urlPercent
	defer func() {
		num = previousNum
		outputDir = previousOutputDir
		urlPercent = previousURLPercent
	}()

	num = 1
	urlPercent = 0
	outputDir = t.TempDir()

	writeGeneratedNamespaceFiles([]string{"default", "platform"})

	for _, filename := range []string{"default.yaml", "platform.yaml"} {
		out, err := os.ReadFile(filepath.Join(outputDir, filename))
		if err != nil {
			t.Fatalf("expected generated namespace file %s: %s", filename, err)
		}
		if !strings.Contains(string(out), "notes:") {
			t.Fatalf("expected generated notes in %s, got:\n%s", filename, out)
		}
	}
}

// TestWriteGeneratedNamespaceFilesPreservesExistingFiles verifies output writes are scoped.
func TestWriteGeneratedNamespaceFilesPreservesExistingFiles(t *testing.T) {
	previousNum := num
	previousOutputDir := outputDir
	previousURLPercent := urlPercent
	defer func() {
		num = previousNum
		outputDir = previousOutputDir
		urlPercent = previousURLPercent
	}()

	num = 1
	urlPercent = 0
	outputDir = t.TempDir()
	keepFile := filepath.Join(outputDir, "keep.txt")
	if err := os.WriteFile(keepFile, []byte("do not delete"), 0o644); err != nil {
		t.Fatalf("write existing file: %s", err)
	}

	writeGeneratedNamespaceFiles([]string{"default"})

	out, err := os.ReadFile(keepFile)
	if err != nil {
		t.Fatalf("expected existing file to remain: %s", err)
	}
	if string(out) != "do not delete" {
		t.Fatalf("expected existing file content to remain, got %q", out)
	}
}
