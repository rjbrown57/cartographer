package ui

import (
	"net/http"
	"strings"
	"testing"
)

// TestValidateDiagramData checks malformed scenes and the image-bearing size boundary.
func TestValidateDiagramData(t *testing.T) {
	valid := map[string]any{"kind": "diagram", "version": float64(1), "scene": map[string]any{"elements": []any{}, "appState": map[string]any{}, "files": map[string]any{}}}
	if status, message := validateDiagramData(valid); status != 0 {
		t.Fatalf("valid diagram rejected: %d %s", status, message)
	}
	if status, _ := validateDiagramData(map[string]any{"kind": "diagram", "version": float64(1)}); status != http.StatusBadRequest {
		t.Fatalf("malformed diagram status = %d", status)
	}
	large := map[string]any{"kind": "diagram", "version": float64(1), "scene": map[string]any{"elements": []any{}, "appState": map[string]any{}, "files": map[string]any{"image": map[string]any{"dataURL": "data:image/png;base64," + strings.Repeat("A", maxDiagramDataBytes)}}}}
	if status, _ := validateDiagramData(large); status != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversize diagram status = %d", status)
	}
}
