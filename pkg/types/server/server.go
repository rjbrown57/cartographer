package server

import (
	"fmt"
	"sync"

	"net"

	"github.com/rjbrown57/cartographer/pkg/backends/inmemory"
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
	cache      map[string]any
	groupCache map[string]*proto.Group
	tagCache   map[string]*proto.Tag
	mu         sync.Mutex
}

func (c *CartographerServer) Serve() {
	log.Infof("Staring cartographer server on :%s", c.Listener.Addr().String())
	if err := c.Server.Serve(c.Listener); err != nil {
		log.Fatalf("Failed to Serve %v", err)
	}
}

func NewCartographerServer(o *CartographerServerOptions) *CartographerServer {

	var err error

	conf := config.NewCartographerConfig(o.ConfigFile)

	c := CartographerServer{
		Backend:   inmemory.NewInMemoryBackend(),
		Options:   o,
		Notifier:  notifier.NewNotifier(),
		WebServer: ui.NewCartographerUI(&conf.ServerConfig),

		config:     conf,
		cache:      make(map[string]any),
		groupCache: make(map[string]*proto.Group),
		tagCache:   make(map[string]*proto.Tag),
		mu:         sync.Mutex{},
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
