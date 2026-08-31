package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	basic "github.com/rjbrown57/cartographer/explorer/basic/pkg"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/explorer"
)

// main configures and runs the basic explorer through the shared snapshot runner.
func main() {
	var discoveryTimeout time.Duration
	var interval time.Duration
	var address string
	var namespace string
	var port int
	var sourceID string
	var targetURL string

	flag.StringVar(&address, "address", "localhost", "Cartographer gRPC address")
	flag.IntVar(&port, "port", 8080, "Cartographer gRPC port")
	flag.StringVar(&namespace, "namespace", basic.DefaultNamespace, "target Cartographer namespace")
	flag.StringVar(&sourceID, "source-id", basic.DefaultSourceID, "stable explorer source identity")
	flag.StringVar(&targetURL, "url", "", "target URL to fetch data from (required)")
	flag.DurationVar(&interval, "interval", 0, "refresh interval; zero runs once")
	flag.DurationVar(&discoveryTimeout, "discovery-timeout", 30*time.Second, "timeout for one discovery")
	flag.Parse()

	if targetURL == "" {
		log.Fatalf("Usage: %s -url <target-url>", flag.CommandLine.Name())
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cc := client.NewCartographerClient(&client.CartographerClientOptions{
		Address: address,
		Port:    port,
		Ctx:     ctx,
	})
	defer cc.ClientConn.Close()

	// https://restcountries.com/v3.1/name/deutschland
	// is a good example of a target URL

	runner, err := explorer.NewRunner(explorer.RunnerOptions{
		Explorer: basic.NewBasicExplorer(&basic.BasicExplorerOptions{
			ExplorerSourceID: sourceID,
			TargetNamespace:  namespace,
			TargetURL:        targetURL,
		}),
		Client:           cc.Client,
		Interval:         interval,
		DiscoveryTimeout: discoveryTimeout,
	})
	if err != nil {
		log.Fatalf("Failed to create runner %v", err)
	}

	if err := runner.Run(ctx); err != nil {
		log.Fatalf("Explorer failed: %v", err)
	}
}
