package k8s

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// TestK8sExplorerDiscover verifies Kubernetes nodes are returned as one stable snapshot note.
func TestK8sExplorerDiscover(t *testing.T) {
	client := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-a"}},
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-b"}},
	)
	explorer := NewK8sExplorer(&K8sExplorerOptions{
		TargetNamespace:  "clusters",
		ExplorerSourceID: "production-cluster",
		KubernetesClient: client,
	})

	notes, err := explorer.Discover(context.Background())
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	if len(notes) != 1 {
		t.Fatalf("Discover() note count = %d, want 1", len(notes))
	}
	if got := explorer.Namespace(); got != "clusters" {
		t.Fatalf("Namespace() = %q, want clusters", got)
	}
	if got := explorer.SourceID(); got != "production-cluster" {
		t.Fatalf("SourceID() = %q, want production-cluster", got)
	}

	note := notes[0]
	if got := note.GetKey(); got != "k8s" {
		t.Fatalf("note ID = %q, want k8s", got)
	}
	if got := note.GetAnnotations()[explorerTypeAnnotation]; got != "kubernetes" {
		t.Fatalf("explorer annotation = %q, want kubernetes", got)
	}
	data := note.GetData().AsMap()["data"].([]any)
	if len(data) != 2 || data[0] != "node-a" || data[1] != "node-b" {
		t.Fatalf("node data = %v, want node-a and node-b", data)
	}
}
