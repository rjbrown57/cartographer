package server

import (
	"fmt"
	"sync"

	"net"

	"github.com/blevesearch/bleve"
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/types/notifier"
	"github.com/rjbrown57/cartographer/pkg/types/ui"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"google.golang.org/grpc"
)

type CartographerServerOptions struct {
	ConfigFile string
}

type CartographerServer struct {
	proto.UnimplementedCartographerServer

	Backend   backend.Backend
	Server    *grpc.Server
	Listener  net.Listener
	Notifier  *notifier.Notifier
	Options   *CartographerServerOptions
	WebServer *ui.CartographerUI

	config     *config.CartographerConfig
	cache      map[string]*proto.Link   // cache by key of all links
	groupCache map[string]*proto.Group  // cache by name of all groups, should be refactored to provide links
	tagCache   map[string][]*proto.Link // cache by tag string that links to all known matching links
	mu         sync.Mutex
	bleve      bleve.Index
}

func (c *CartographerServer) Serve() {
	log.Infof("Staring cartographer server on :%s", c.Listener.Addr().String())
	if err := c.Server.Serve(c.Listener); err != nil {
		log.Fatalf("Failed to Serve %v", err)
	}
}

// Close gracefully shuts down the server and closes the backend
func (c *CartographerServer) Close() error {
	log.Infof("Shutting down cartographer server...")

	// Gracefully stop the gRPC server
	if c.Server != nil {
		c.Server.GracefulStop()
	}

	// Close the listener
	if c.Listener != nil {
		c.Listener.Close()
	}

	// Close the backend
	if err := c.Backend.Close(); err != nil {
		log.Errorf("Error closing backend: %v", err)
		return err
	}

	if err := c.bleve.Close(); err != nil {
		log.Errorf("Error closing bleve index: %v", err)
		return err
	}

	return nil
}

func NewCartographerServer(o *CartographerServerOptions) *CartographerServer {

	var err error

	conf := config.NewCartographerConfig(o.ConfigFile)

	c := CartographerServer{
		Backend:   conf.ServerConfig.Backend.GetBackend(),
		Options:   o,
		Notifier:  notifier.NewNotifier(),
		WebServer: ui.NewCartographerUI(&conf.ServerConfig),

		config:     conf,
		cache:      make(map[string]*proto.Link),
		groupCache: make(map[string]*proto.Group),
		tagCache:   make(map[string][]*proto.Link),
		mu:         sync.Mutex{},
	}

	mapping := bleve.NewIndexMapping()
	c.bleve, err = bleve.NewMemOnly(mapping)
	if err != nil {
		log.Fatalf("Error creating bleve index: %v", err)
	}

	err = c.Initialize()
	if err != nil {
		log.Fatalf("%s", err)
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
