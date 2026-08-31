package basic

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

const (
	// DefaultNamespace is the namespace used when the basic explorer is not configured explicitly.
	DefaultNamespace = "basicexplorer"
	// DefaultSourceID is the ownership identity used by the basic explorer.
	DefaultSourceID        = "basic"
	explorerTypeAnnotation = "cartographer.io/explorer"
	maxResponseBytes       = 10 << 20
)

// NewBasicExplorer constructs a basic HTTP explorer with stable identity defaults.
func NewBasicExplorer(o *BasicExplorerOptions) *BasicExplorer {
	if o == nil {
		o = &BasicExplorerOptions{}
	}

	if o.TargetNamespace == "" {
		o.TargetNamespace = DefaultNamespace
	}
	if o.ExplorerSourceID == "" {
		o.ExplorerSourceID = DefaultSourceID
	}

	return &BasicExplorer{
		options: o,
	}
}

// BasicExplorerOptions configures the HTTP target and Cartographer snapshot identity.
type BasicExplorerOptions struct {
	ExplorerSourceID string
	TargetNamespace  string
	TargetURL        string
}

// BasicExplorer discovers JSON from one HTTP endpoint.
type BasicExplorer struct {
	options *BasicExplorerOptions
}

// Discover fetches and decodes the complete JSON snapshot from the configured target.
func (e *BasicExplorer) Discover(ctx context.Context) ([]*proto.Note, error) {
	if e.options.TargetURL == "" {
		return nil, fmt.Errorf("target URL is required")
	}

	jsonData, err := getJSONData(ctx, e.options.TargetURL)
	if err != nil {
		return nil, err
	}

	// Parse the JSON data - handle both arrays and objects
	var parsedData any
	if err := json.Unmarshal(jsonData, &parsedData); err != nil {
		return nil, fmt.Errorf("decode target JSON: %w", err)
	}

	protoNote, err := proto.NewNoteBuilder().
		WithTags([]string{"explorer"}).
		WithData(map[string]any{"data": parsedData}).
		WithId(e.options.TargetURL).
		WithAnnotations(map[string]string{explorerTypeAnnotation: "basic"}).
		Build()
	if err != nil {
		return nil, err
	}

	return []*proto.Note{protoNote}, nil
}

// Namespace returns the Cartographer namespace targeted by this explorer.
func (e *BasicExplorer) Namespace() string {
	return e.options.TargetNamespace
}

// SourceID returns the stable ownership identity for this explorer snapshot.
func (e *BasicExplorer) SourceID() string {
	return e.options.ExplorerSourceID
}

// getJSONData retrieves one bounded successful response using the discovery context.
func getJSONData(ctx context.Context, targetURL string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create target request: %w", err)
	}

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request target URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("target URL returned %s", resp.Status)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read target response: %w", err)
	}
	if len(data) > maxResponseBytes {
		return nil, fmt.Errorf("target response exceeds %d bytes", maxResponseBytes)
	}
	return data, nil
}
