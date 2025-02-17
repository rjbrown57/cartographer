package ui

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/log"

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

func NewCartographerUI(o *config.ServerConfig) *CartographerUI {

	co := client.CartographerClientOptions{
		Address: o.Address,
		Port:    o.Port,
	}

	carto := client.NewCartographerClient(&co)

	c := CartographerUI{
		Client:   carto,
		Server:   NewGinServer(carto, &o.WebConfig),
		Port:     o.WebConfig.Port,
		Address:  o.WebConfig.Address,
		sitename: o.WebConfig.SiteName,
	}

	return &c
}

func (c *CartographerUI) Serve() {
	log.Fatalf("%v", c.Server.Run(fmt.Sprintf(":%d", c.Port)))
}
