package server

import (
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// TestNSCacheGetLinksMissingNamespace verifies GetLinks returns nil for a namespace that does not exist.
func TestNSCacheGetLinksMissingNamespace(t *testing.T) {
	cache := NSCache{}

	links := cache.GetLinks("missing")
	if links != nil {
		t.Fatalf("expected nil links for missing namespace, got len=%d", len(links))
	}
}

// TestNSCacheGetLinks verifies GetLinks returns a namespace-scoped snapshot of cached links.
func TestNSCacheGetLinks(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Link{Id: "l1"}
	link2 := &proto.Link{Id: "l2"}
	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)

	links := cache.GetLinks("default")
	if got := len(links); got != 2 {
		t.Fatalf("expected 2 links, got %d", got)
	}

	seen := map[string]bool{}
	for _, link := range links {
		seen[link.GetKey()] = true
	}
	if !seen["l1"] || !seen["l2"] {
		t.Fatalf("expected links l1 and l2 in snapshot, got seen=%v", seen)
	}

	links = links[:0]
	if got := len(cache.GetLinks("default")); got != 2 {
		t.Fatalf("expected cache to remain unchanged after local slice mutation, got %d", got)
	}
}

// TestNSCacheGetGroupsMissingNamespace verifies GetGroups returns nil for a namespace that does not exist.
func TestNSCacheGetGroupsMissingNamespace(t *testing.T) {
	cache := NSCache{}

	groups := cache.GetGroups("missing")
	if groups != nil {
		t.Fatalf("expected nil groups for missing namespace, got len=%d", len(groups))
	}
}

// TestNSCacheGetGroups verifies GetGroups returns group names scoped to a namespace.
func TestNSCacheGetGroups(t *testing.T) {
	cache := NSCache{}

	cache.AddToCache("default", &proto.Group{Name: "platform"})
	cache.AddToCache("default", &proto.Group{Name: "devex"})

	groups := cache.GetGroups("default")
	if got := len(groups); got != 2 {
		t.Fatalf("expected 2 groups, got %d", got)
	}

	seen := map[string]bool{}
	for _, group := range groups {
		seen[group] = true
	}
	if !seen["platform"] || !seen["devex"] {
		t.Fatalf("expected groups platform and devex in snapshot, got seen=%v", seen)
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

	cache.AddToCache("default", &proto.Link{Id: "l1", Tags: []string{"k8s", "dev"}})
	cache.AddToCache("default", &proto.Link{Id: "l2", Tags: []string{"k8s", "security"}})

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

// TestNewCartoNamespace verifies a namespace starts with initialized empty caches and the expected name.
func TestNewCartoNamespace(t *testing.T) {
	ns := NewCartoNamespace("dev")

	if ns == nil {
		t.Fatal("expected namespace to be created")
	}

	if ns.name != "dev" {
		t.Fatalf("expected namespace name %q, got %q", "dev", ns.name)
	}

	if ns.LinkCache == nil || len(ns.LinkCache) != 0 {
		t.Fatalf("expected empty initialized LinkCache, got len=%d", len(ns.LinkCache))
	}

	if ns.GroupCache == nil || len(ns.GroupCache) != 0 {
		t.Fatalf("expected empty initialized GroupCache, got len=%d", len(ns.GroupCache))
	}

	if ns.tagCache == nil || len(ns.tagCache) != 0 {
		t.Fatalf("expected empty initialized tagCache, got len=%d", len(ns.tagCache))
	}
}

// TestNSCacheAddToCache verifies adding links and groups creates namespaces lazily and maintains tag indexes.
func TestNSCacheAddToCache(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Link{Id: "l1", Tags: []string{"k8s", "dev"}}
	link2 := &proto.Link{Id: "l2", Tags: []string{"k8s"}}
	group := &proto.Group{Name: "platform"}

	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)
	cache.AddToCache("default", group)

	ns, ok := cache["default"]
	if !ok {
		t.Fatal("expected namespace to be created")
	}

	if got := ns.LinkCache["l1"]; got != link1 {
		t.Fatalf("expected link l1 to be cached")
	}
	if got := ns.LinkCache["l2"]; got != link2 {
		t.Fatalf("expected link l2 to be cached")
	}
	if got := ns.GroupCache["platform"]; got != group {
		t.Fatalf("expected group platform to be cached")
	}

	if got := len(ns.tagCache["k8s"]); got != 2 {
		t.Fatalf("expected 2 links indexed for tag k8s, got %d", got)
	}
	if got := len(ns.tagCache["dev"]); got != 1 {
		t.Fatalf("expected 1 link indexed for tag dev, got %d", got)
	}
}

// TestNSCacheDeleteFromCache verifies deleting links updates both the link cache and reverse tag index.
func TestNSCacheDeleteFromCache(t *testing.T) {
	cache := NSCache{}

	link1 := &proto.Link{Id: "l1", Tags: []string{"k8s", "dev"}}
	link2 := &proto.Link{Id: "l2", Tags: []string{"k8s"}}
	cache.AddToCache("default", link1)
	cache.AddToCache("default", link2)

	cache.DeleteFromCache("default", "l1")

	ns := cache["default"]
	if _, ok := ns.LinkCache["l1"]; ok {
		t.Fatal("expected link l1 to be removed from LinkCache")
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

	cache.AddToCache("default", &proto.Link{Id: "l1", Tags: []string{"k8s"}})
	cache.DeleteFromCache("default", "does-not-exist")

	ns := cache["default"]
	if _, ok := ns.LinkCache["l1"]; !ok {
		t.Fatal("expected existing link to remain after deleting missing key")
	}
	if got := len(ns.tagCache["k8s"]); got != 1 {
		t.Fatalf("expected tag index to remain intact, got %d", got)
	}
}
