package ui

import (
	"strings"
	"testing"
)

// TestTemplateRoundTrip verifies template payloads survive internal note conversion.
func TestTemplateRoundTrip(t *testing.T) {
	template := markdownTemplate{
		Name:        "Incident Review",
		Description: "A reusable incident review note.",
		Body:        "## Summary\n\n- Impact:",
		Tags:        []string{"incident", " review ", ""},
	}

	note, err := templateToNote(template)
	if err != nil {
		t.Fatalf("templateToNote() error = %v", err)
	}
	if !strings.HasPrefix(note.GetId(), templateKeyPrefix) {
		t.Fatalf("expected template id prefix, got %q", note.GetId())
	}
	if got := note.GetSource(); got != templateSource {
		t.Fatalf("expected source %q, got %q", templateSource, got)
	}
	if got := note.GetAuthor(); got != templateAuthor {
		t.Fatalf("expected author %q, got %q", templateAuthor, got)
	}

	roundTrip := noteToTemplate(note)
	if got := roundTrip.Name; got != template.Name {
		t.Fatalf("expected name %q, got %q", template.Name, got)
	}
	if got := roundTrip.Description; got != template.Description {
		t.Fatalf("expected description %q, got %q", template.Description, got)
	}
	if got := roundTrip.Body; got != template.Body {
		t.Fatalf("expected body %q, got %q", template.Body, got)
	}
	if got := roundTrip.Tags; len(got) != 2 || got[0] != "incident" || got[1] != "review" {
		t.Fatalf("expected cleaned tags, got %v", got)
	}
}

// TestTemplateToNotePreservesExistingID verifies template edits reuse existing ids.
func TestTemplateToNotePreservesExistingID(t *testing.T) {
	template := markdownTemplate{
		ID:   "incident-review",
		Name: "Incident Review",
		Body: "## Summary",
	}

	note, err := templateToNote(template)
	if err != nil {
		t.Fatalf("templateToNote() error = %v", err)
	}
	if got := note.GetId(); got != "template/incident-review" {
		t.Fatalf("expected existing template id to be preserved, got %q", got)
	}
}

// TestTemplateNoteIDRejectsInvalidID verifies delete ids stay under template storage.
func TestTemplateNoteIDRejectsInvalidID(t *testing.T) {
	if _, err := templateNoteID("../bad"); err == nil {
		t.Fatal("expected invalid template id to fail")
	}
}

// TestFilterReservedNamespaces hides internal admin storage from normal namespace UI.
func TestFilterReservedNamespaces(t *testing.T) {
	got := filterReservedNamespaces([]string{"default", adminNamespace, "platform"})
	if len(got) != 2 || got[0] != "default" || got[1] != "platform" {
		t.Fatalf("expected reserved namespace filtered, got %v", got)
	}
}
