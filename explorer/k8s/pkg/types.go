package k8s

import (
	"context"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func NewK8sExplorer(o *K8sExplorerOptions) *K8sExplorer {
	client := client.NewCartographerClient(o.CartographerClientOptions)

	return &K8sExplorer{
		client:    client,
		options:   o,
		k8sClient: NewK8sClient(),
	}

}

type K8sExplorerOptions struct {
	CartographerClientOptions *client.CartographerClientOptions
}

type K8sExplorer struct {
	client    *client.CartographerClient
	options   *K8sExplorerOptions
	k8sClient *kubernetes.Clientset
}

func (k *K8sExplorer) Start() error {

	r, err := k.GetRequest()
	if err != nil {
		return err
	}

	_, err = k.client.Client.Add(k.client.Ctx, r)
	if err != nil {
		return err
	}

	return nil
}

// GetData will query the target and return the data, format it as a proto.CartographerAddRequest
func (e *K8sExplorer) GetRequest() (*proto.CartographerAddRequest, error) {
	// Need to refactor this Constructors to be more useful
	r := proto.NewCartographerAddRequest(nil, nil, nil)

	nodes, err := e.k8sClient.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodeNames := make([]any, 0)
	for _, node := range nodes.Items {
		nodeNames = append(nodeNames, node.Name)
	}

	protoLink, err := proto.NewLinkBuilder().
		WithData(map[string]any{"data": nodeNames}).
		WithTags([]string{"explorer"}).
		WithId("k8s").
		Build()
	if err != nil {
		return nil, err
	}

	r.Request.Links = append(r.Request.Links, protoLink)

	return r, nil
}
