package server

import (
	"encoding/json"
	"fmt"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

const maxDiagramDataBytes = 2 * 1024 * 1024

// validateDiagramNote checks the stored scene format and its encoded size.
func validateDiagramNote(note *proto.Note) error {
	if note.GetData() == nil {
		return nil
	}
	data := note.GetData().AsMap()
	if data["kind"] != "diagram" {
		return nil
	}
	if data["version"] != float64(1) {
		return fmt.Errorf("unsupported diagram version")
	}
	scene, ok := data["scene"].(map[string]any)
	if !ok {
		return fmt.Errorf("invalid diagram scene")
	}
	if _, ok := scene["elements"].([]any); !ok {
		return fmt.Errorf("invalid diagram elements")
	}
	if _, ok := scene["appState"].(map[string]any); !ok {
		return fmt.Errorf("invalid diagram app state")
	}
	if _, ok := scene["files"].(map[string]any); !ok {
		return fmt.Errorf("invalid diagram files")
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("invalid diagram data: %w", err)
	}
	if len(encoded) > maxDiagramDataBytes {
		return fmt.Errorf("diagram exceeds the 2 MiB limit")
	}
	return nil
}
