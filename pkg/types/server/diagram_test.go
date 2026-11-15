package server

import (
	"strings"
	"testing"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

// TestValidateDiagramNote checks the same scene limit used by gRPC writes and archive imports.
func TestValidateDiagramNote(t *testing.T) {
	scene := map[string]any{"elements": []any{}, "appState": map[string]any{}, "files": map[string]any{}}
	for _, test := range []struct {
		name      string
		data      map[string]any
		wantError bool
	}{
		{name: "valid", data: map[string]any{"kind": "diagram", "version": 1, "scene": scene}},
		{name: "missing app state", data: map[string]any{"kind": "diagram", "version": 1, "scene": map[string]any{"elements": []any{}, "files": map[string]any{}}}, wantError: true},
		{name: "oversized image", data: map[string]any{"kind": "diagram", "version": 1, "scene": map[string]any{"elements": []any{}, "appState": map[string]any{}, "files": map[string]any{"image": map[string]any{"dataURL": "data:image/png;base64," + strings.Repeat("A", maxDiagramDataBytes)}}}}, wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			data, err := structpb.NewStruct(test.data)
			if err != nil {
				t.Fatal(err)
			}
			err = validateDiagramNote(&proto.Note{Data: data})
			if (err != nil) != test.wantError {
				t.Fatalf("validateDiagramNote() error = %v, want error %t", err, test.wantError)
			}
		})
	}
}
