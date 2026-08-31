package k8s

import (
	"errors"
	"fmt"
	"log"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

// GetConfig returns in-cluster configuration or falls back to the current kubeconfig.
func GetConfig() *rest.Config {

	var config *rest.Config
	var err error

	config, err = rest.InClusterConfig()
	// If we are not in a cluster, we will try to use the kubeconfig file
	if errors.Is(err, rest.ErrNotInCluster) {
		kubeconfig := fmt.Sprintf("%s/.kube/config", homedir.HomeDir())

		// use the current context in kubeconfig
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			log.Fatalf("Error creating kubeconfig: %v", err)
		}
	} else if err != nil {
		log.Fatalf("Error getting in-cluster config: %v", err)
	}

	return config
}

// NewK8sClient constructs a Kubernetes client from the resolved configuration.
func NewK8sClient() *kubernetes.Clientset {
	clientset, err := kubernetes.NewForConfig(GetConfig())
	if err != nil {
		log.Fatalf("Error creating kubernetes clientset: %v", err)
	}
	return clientset
}
