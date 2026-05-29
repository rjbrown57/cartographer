package server

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestNSCacheGetNotesMissingNamespace verifies GetNotes returns nil for a namespace that does not exist.
func TestNSCacheGetNotesMissingNamespace(t *testing.T) {
	cache := NSCache{}

	notes := cache.GetNotes("missing")
	if notes != nil {
		t.Fatalf("expected nil notes for missing namespace, got len=%d", len(notes))
	}
}

// TestNSCacheGetNotes verifies GetNotes returns a namespace-scoped snapshot of cached notes.
func TestNSCacheGetNotes(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Note{Id: "l1"}
	link2 := &proto.Note{Id: "l2"}
	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)

	notes := cache.GetNotes("default")
	if got := len(notes); got != 2 {
		t.Fatalf("expected 2 notes, got %d", got)
	}

	seen := map[string]bool{}
	for _, link := range notes {
		seen[link.GetKey()] = true
	}
	if !seen["l1"] || !seen["l2"] {
		t.Fatalf("expected notes l1 and l2 in snapshot, got seen=%v", seen)
	}

	notes = notes[:0]
	if got := len(cache.GetNotes("default")); got != 2 {
		t.Fatalf("expected cache to remain unchanged after local slice mutation, got %d", got)
	}
}

// TestNSCacheGetTagsMissingNamespace verifies GetTags returns nil for a namespace that does not exist.
func TestNSCacheGetTagsMissingNamespace(t *testing.T) {
	cache := NSCache{}

	tags := cache.GetTags("missing")
	if tags != nil {
		t.Fatalf("expected nil tags for missing namespace, got len=%d", len(tags))
	}
}

// TestNSCacheGetTags verifies GetTags returns tag names scoped to a namespace.
func TestNSCacheGetTags(t *testing.T) {
	cache := NSCache{}

	cache.AddToCache("default", &proto.Note{Id: "l1", Tags: []string{"k8s", "dev"}})
	cache.AddToCache("default", &proto.Note{Id: "l2", Tags: []string{"k8s", "security"}})

	tags := cache.GetTags("default")
	if got := len(tags); got != 3 {
		t.Fatalf("expected 3 unique tags, got %d", got)
	}

	seen := map[string]bool{}
	for _, tag := range tags {
		seen[tag] = true
	}
	if !seen["k8s"] || !seen["dev"] || !seen["security"] {
		t.Fatalf("expected tags k8s, dev, security in snapshot, got seen=%v", seen)
	}
}

// TestNSCacheGetNamespaces verifies GetNamespaces returns all currently allocated namespace keys.
func TestNSCacheGetNamespaces(t *testing.T) {
	cache := NSCache{}

	cache.AddToCache("default", &proto.Note{Id: "l1"})
	cache.AddToCache("dev", &proto.Note{Id: "l2"})

	namespaces := cache.GetNamespaces()
	if got := len(namespaces); got != 2 {
		t.Fatalf("expected 2 namespaces, got %d", got)
	}

	seen := map[string]bool{}
	for _, ns := range namespaces {
		seen[ns] = true
	}

	if !seen["default"] || !seen["dev"] {
		t.Fatalf("expected namespaces default and dev in snapshot, got seen=%v", seen)
	}
}

// TestNewCartoNamespace verifies a namespace starts with initialized empty caches and the expected name.
func TestNewCartoNamespace(t *testing.T) {
	ns := NewCartoNamespace("dev")

	if ns == nil {
		t.Fatal("expected namespace to be created")
	}

	if ns.name != "dev" {
		t.Fatalf("expected namespace name %q, got %q", "dev", ns.name)
	}

	if ns.NoteCache == nil || len(ns.NoteCache) != 0 {
		t.Fatalf("expected empty initialized NoteCache, got len=%d", len(ns.NoteCache))
	}

	if ns.tagCache == nil || len(ns.tagCache) != 0 {
		t.Fatalf("expected empty initialized tagCache, got len=%d", len(ns.tagCache))
	}
}

// TestNSCacheAddToCache verifies adding notes creates namespaces lazily and maintains tag indexes.
func TestNSCacheAddToCache(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Note{Id: "l1", Tags: []string{"k8s", "dev"}}
	link2 := &proto.Note{Id: "l2", Tags: []string{"k8s"}}

	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)

	ns, ok := cache["default"]
	if !ok {
		t.Fatal("expected namespace to be created")
	}

	if got := ns.NoteCache["l1"]; got != link1 {
		t.Fatalf("expected link l1 to be cached")
	}
	if got := ns.NoteCache["l2"]; got != link2 {
		t.Fatalf("expected link l2 to be cached")
	}

	if got := len(ns.tagCache["k8s"]); got != 2 {
		t.Fatalf("expected 2 notes indexed for tag k8s, got %d", got)
	}
	if got := len(ns.tagCache["dev"]); got != 1 {
		t.Fatalf("expected 1 link indexed for tag dev, got %d", got)
	}
}

// TestNSCacheAddToCacheReplacesExistingNote verifies edits refresh tag indexes.
func TestNSCacheAddToCacheReplacesExistingNote(t *testing.T) {
	cache := NSCache{}

	original := &proto.Note{Id: "n1", Tags: []string{"old", "shared"}, Body: "before"}
	updated := &proto.Note{Id: "n1", Tags: []string{"new", "shared"}, Body: "after"}

	cache.AddToCache("default", original)
	cache.AddToCache("default", updated)

	ns := cache["default"]
	if got := ns.NoteCache["n1"]; got != updated {
		t.Fatal("expected updated note to replace original note")
	}
	if _, ok := ns.tagCache["old"]; ok {
		t.Fatal("expected old tag index entry to be removed")
	}
	if got := len(ns.tagCache["new"]); got != 1 {
		t.Fatalf("expected new tag to contain updated note, got %d", got)
	}
	if got := len(ns.tagCache["shared"]); got != 1 {
		t.Fatalf("expected shared tag to contain one updated note, got %d", got)
	}
	if got := ns.tagCache["shared"][0].GetBody(); got != "after" {
		t.Fatalf("expected shared tag to point at updated note, got body %q", got)
	}
}

// TestNSCacheDeleteFromCache verifies deleting notes updates both the link cache and reverse tag index.
func TestNSCacheDeleteFromCache(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Note{Id: "l1", Tags: []string{"k8s", "dev"}}
	link2 := &proto.Note{Id: "l2", Tags: []string{"k8s"}}
	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)

	cache.DeleteFromCache("default", "l1")

	ns := cache["default"]
	if _, ok := ns.NoteCache["l1"]; ok {
		t.Fatal("expected link l1 to be removed from NoteCache")
	}

	if got := len(ns.tagCache["k8s"]); got != 1 {
		t.Fatalf("expected tag k8s to contain 1 link after delete, got %d", got)
	}
	if ns.tagCache["k8s"][0].GetKey() != "l2" {
		t.Fatalf("expected remaining k8s link to be l2, got %q", ns.tagCache["k8s"][0].GetKey())
	}

	if _, ok := ns.tagCache["dev"]; ok {
		t.Fatal("expected empty tag dev to be removed from tagCache")
	}
}

// TestNSCacheDeleteFromCacheMissing verifies delete operations are safe for missing namespaces and keys.
func TestNSCacheDeleteFromCacheMissing(t *testing.T) {
	cache := NSCache{}

	cache.DeleteFromCache("missing", "l1")

	cache.AddToCache("default", &proto.Note{Id: "l1", Tags: []string{"k8s"}})
	cache.DeleteFromCache("default", "does-not-exist")

	ns := cache["default"]
	if _, ok := ns.NoteCache["l1"]; !ok {
		t.Fatal("expected existing link to remain after deleting missing key")
	}
	if got := len(ns.tagCache["k8s"]); got != 1 {
		t.Fatalf("expected tag index to remain intact, got %d", got)
	}
}
