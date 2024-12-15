package server

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/rjbrown57/cartographer/pkg/backends/inmemory"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/types/ui"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

type CartographerServerOptions struct {
	ConfigFile string
}

type CartographerServer struct {
	proto.UnimplementedCartographerServer

	Server    *grpc.Server
	WebServer *ui.CartographerUI
	Listener  net.Listener
	Options   *CartographerServerOptions

	Backend backend.Backend

	config *config.CartographerConfig
}

func (c *CartographerServer) Serve() {
	log.Printf("Staring cartographer server on :%s", c.Listener.Addr().String())
	if err := c.Server.Serve(c.Listener); err != nil {
		log.Fatalf("Failed to Serve %v", err)
	}
}

func NewCartographerServer(o *CartographerServerOptions) *CartographerServer {

	var err error

	conf := config.NewCartographerConfig(o.ConfigFile)

	c := CartographerServer{
		Options:   o,
		Backend:   inmemory.NewInMemoryBackend(&conf.ServerConfig.BackupConfig),
		WebServer: ui.NewCartographerUI(&conf.ServerConfig),
	}

	err = c.Backend.Initialize(conf)
	if err != nil {
		log.Fatal(err)
	}

	// If a backup file is configured, and exists, load it
	if conf.ServerConfig.BackupConfig.Enabled {
		fileInfo, err := os.Stat(conf.ServerConfig.BackupConfig.BackupPath)
		if err == nil && fileInfo.Size() > 0 {
			bc := config.NewCartographerConfig(conf.ServerConfig.BackupConfig.BackupPath)
			err := c.Backend.Initialize(bc)
			if err != nil {
				log.Fatal(err)
			}
		}
	}

	c.Listener, err = net.Listen("tcp", fmt.Sprintf("%s:%d", conf.ServerConfig.Address, conf.ServerConfig.Port))
	if err != nil {
		log.Fatalf("Unable to get listener on %d", conf.ServerConfig.Port)
	}

	c.Server = grpc.NewServer()

	// handle this better :0)
	go c.WebServer.Serve()

	proto.RegisterCartographerServer(c.Server, &c)

	return &c
}
