package main

import (
	"flag"
	"log"

	basic "github.com/rjbrown57/cartographer/explorer/basic/pkg"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	Explorer "github.com/rjbrown57/cartographer/pkg/types/explorer"
)

// BasicExplorer is a simple explorer that will add a data point to the cartographer server
func main() {
	var targetURL string
	flag.StringVar(&targetURL, "url", "", "Target URL to fetch data from (required)")
	flag.Parse()

	if targetURL == "" {
		log.Fatalf("Usage: %s -url <target-url>", flag.CommandLine.Name())
	}

	// https://restcountries.com/v3.1/name/deutschland
	// is a good example of a target URL

	var e Explorer.Explorer = basic.NewBasicExplorer(&basic.BasicExplorerOptions{
		CartographerClientOptions: &client.CartographerClientOptions{
			Address: "localhost",
			Port:    8080,
		},
		TargetUrl: targetURL,
	})

	if err := e.Start(); err != nil {
		log.Fatalf("Error starting explorer: %v", err)
	}
}
