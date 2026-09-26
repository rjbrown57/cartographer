package ui

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/log"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

type CartographerUI struct {
	Address      string
	Server       *gin.Engine
	Client       *client.CartographerClient
	Port         int
	ServerConfig *config.ServerConfig

	sitename string
}

// NewCartographerUI connects the UI client and archive service to the HTTP router.
func NewCartographerUI(o *config.ServerConfig, archives ...backend.ArchiveService) *CartographerUI {

	co := client.CartographerClientOptions{
		Address: o.Address,
		Port:    o.Port,
	}

	carto := client.NewCartographerClient(&co)

	c := CartographerUI{
		Client:   carto,
		Server:   NewGinServer(carto, &o.WebConfig, archives...),
		Port:     o.WebConfig.Port,
		Address:  o.WebConfig.Address,
		sitename: o.WebConfig.SiteName,
	}

	return &c
}

// We should refactor this to use the http.Server instead of the gin.Engine to allow for graceful shutdown
func (c *CartographerUI) Serve() {
	log.Fatalf("%v", c.Server.Run(fmt.Sprintf(":%d", c.Port)))
}
