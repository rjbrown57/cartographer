package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	k8s "github.com/rjbrown57/cartographer/explorer/k8s/pkg"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/explorer"
)

// main configures and runs the Kubernetes explorer through the shared snapshot runner.
func main() {
	var address string
	var discoveryTimeout time.Duration
	var interval time.Duration
	var namespace string
	var port int
	var sourceID string

	flag.StringVar(&address, "address", "localhost", "Cartographer gRPC address")
	flag.IntVar(&port, "port", 8080, "Cartographer gRPC port")
	flag.StringVar(&namespace, "namespace", k8s.DefaultNamespace, "target Cartographer namespace")
	flag.StringVar(&sourceID, "source-id", k8s.DefaultSourceID, "stable explorer source identity")
	flag.DurationVar(&interval, "interval", 0, "refresh interval; zero runs once")
	flag.DurationVar(&discoveryTimeout, "discovery-timeout", 30*time.Second, "timeout for one discovery")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cartographerClient := client.NewCartographerClient(&client.CartographerClientOptions{
		Address: address,
		Port:    port,
		Ctx:     ctx,
	})
	defer cartographerClient.ClientConn.Close()

	runner, err := explorer.NewRunner(explorer.RunnerOptions{
		Explorer: k8s.NewK8sExplorer(&k8s.K8sExplorerOptions{
			TargetNamespace:  namespace,
			ExplorerSourceID: sourceID,
		}),
		Client:           cartographerClient.Client,
		Interval:         interval,
		DiscoveryTimeout: discoveryTimeout,
	})
	if err != nil {
		log.Fatalf("Unable to configure explorer: %v", err)
	}

	if err := runner.Run(ctx); err != nil {
		log.Fatalf("Explorer failed: %v", err)
	}
}
