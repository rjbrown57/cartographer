package k8s

import (
	"context"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	// DefaultNamespace is the namespace used when the Kubernetes explorer is not configured explicitly.
	DefaultNamespace = "k8sexplorer"
	// DefaultSourceID is the ownership identity used by the Kubernetes explorer.
	DefaultSourceID        = "kubernetes"
	explorerTypeAnnotation = "cartographer.io/explorer"
)

// K8sExplorerOptions configures snapshot identity and permits client injection for tests.
type K8sExplorerOptions struct {
	TargetNamespace  string
	ExplorerSourceID string
	KubernetesClient kubernetes.Interface
}

// K8sExplorer discovers Kubernetes objects for a Cartographer snapshot.
type K8sExplorer struct {
	options   *K8sExplorerOptions
	k8sClient kubernetes.Interface
}

// NewK8sExplorer constructs a Kubernetes explorer with in-cluster or kubeconfig defaults.
func NewK8sExplorer(options *K8sExplorerOptions) *K8sExplorer {
	if options == nil {
		options = &K8sExplorerOptions{}
	}
	if options.TargetNamespace == "" {
		options.TargetNamespace = DefaultNamespace
	}
	if options.ExplorerSourceID == "" {
		options.ExplorerSourceID = DefaultSourceID
	}
	if options.KubernetesClient == nil {
		options.KubernetesClient = NewK8sClient()
	}

	return &K8sExplorer{
		options:   options,
		k8sClient: options.KubernetesClient,
	}
}

// SourceID returns the stable ownership identity for this explorer snapshot.
func (e *K8sExplorer) SourceID() string {
	return e.options.ExplorerSourceID
}

// Namespace returns the Cartographer namespace targeted by this explorer.
func (e *K8sExplorer) Namespace() string {
	return e.options.TargetNamespace
}

// Discover returns the complete Kubernetes node snapshot as one note.
func (e *K8sExplorer) Discover(ctx context.Context) ([]*proto.Note, error) {
	nodes, err := e.k8sClient.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodeNames := make([]any, 0, len(nodes.Items))
	for _, node := range nodes.Items {
		nodeNames = append(nodeNames, node.Name)
	}

	note, err := proto.NewNoteBuilder().
		WithData(map[string]any{"data": nodeNames}).
		WithTags([]string{"explorer"}).
		WithId("k8s").
		WithTitle("Kubernetes nodes").
		WithSource("explorer:" + e.SourceID()).
		WithAnnotations(map[string]string{explorerTypeAnnotation: "kubernetes"}).
		Build()
	if err != nil {
		return nil, err
	}

	return []*proto.Note{note}, nil
}
