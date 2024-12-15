package main

import (
	"github.com/rjbrown57/cartographer/cmd"
	"github.com/rjbrown57/cartographer/pkg/log"
)

func main() {
	logger := log.Init()
	defer logger.Sync()
	cmd.Execute()
}
