package main

import (
	"log"

	k8s "github.com/rjbrown57/cartographer/explorer/k8s/pkg"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	Explorer "github.com/rjbrown57/cartographer/pkg/types/explorer"
)

// k8s explorer is a simple example of how to use the cartographer client to add data to the cartographer server
func main() {

	var e Explorer.Explorer = k8s.NewK8sExplorer(&k8s.K8sExplorerOptions{
		CartographerClientOptions: &client.CartographerClientOptions{
			Address: "localhost",
			Port:    8080,
		},
	})

	if err := e.Start(); err != nil {
		log.Fatalf("Error starting explorer: %v", err)
	}
}
