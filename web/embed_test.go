package web

import "testing"

// TestReactBundleEmbedded checks that the single binary includes the React entry.
func TestReactBundleEmbedded(t *testing.T) {
	for _, name := range []string{"react/desktop.js", "react/note.js", "react/mobile.js"} {
		asset, err := GetJSFS().Open(name)
		if err != nil {
			t.Fatalf("React bundle %s is missing from embedded assets: %v", name, err)
		}
		if err := asset.Close(); err != nil {
			t.Fatalf("close React bundle %s: %v", name, err)
		}
	}
}
