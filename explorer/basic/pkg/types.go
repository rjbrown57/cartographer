package basic

import (
	"encoding/json"
	"io"
	"net/http"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

func NewBasicExplorer(o *BasicExplorerOptions) *BasicExplorer {
	client := client.NewCartographerClient(o.CartographerClientOptions)

	return &BasicExplorer{
		client:  client,
		options: o,
	}

}

type BasicExplorerOptions struct {
	CartographerClientOptions *client.CartographerClientOptions
	TargetUrl                 string
}

type BasicExplorer struct {
	client  *client.CartographerClient
	options *BasicExplorerOptions
}

func (e *BasicExplorer) Start() error {
	r, err := e.GetRequest()
	if err != nil {
		return err
	}

	_, err = e.client.Client.Add(e.client.Ctx, r)
	if err != nil {
		return err
	}

	return nil
}

// GetData will query the target and return the data, format it as a proto.CartographerAddRequest
func (e *BasicExplorer) GetRequest() (*proto.CartographerAddRequest, error) {
	r := proto.NewCartographerAddRequest(nil, nil, nil)

	jsonData, err := getJsonData(e.options.TargetUrl)
	if err != nil {
		return nil, err
	}

	// Parse the JSON data - handle both arrays and objects
	var parsedData any
	if err := json.Unmarshal(jsonData, &parsedData); err != nil {
		return nil, err
	}

	protoLink, err := proto.NewLinkBuilder().
		WithTags([]string{"explorer"}).
		WithData(map[string]any{"data": parsedData}).
		WithId(e.options.TargetUrl).
		Build()
	if err != nil {
		return nil, err
	}

	r.Request.Links = append(r.Request.Links, protoLink)

	return r, nil
}

func getJsonData(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
