package web

import "testing"

// TestReactBundleEmbedded checks that the single binary includes the React entry.
func TestReactBundleEmbedded(t *testing.T) {
	asset, err := GetJSFS().Open("react/desktop.js")
	if err != nil {
		t.Fatalf("React bundle is missing from embedded assets: %v", err)
	}
	if err := asset.Close(); err != nil {
		t.Fatalf("close React bundle: %v", err)
	}
}
