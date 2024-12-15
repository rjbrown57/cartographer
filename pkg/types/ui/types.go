package ui

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
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

var rootTemplate string = `
<style>
@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.link-card {
	animation: fadeIn 0.5s ease-in-out;
}
</style>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cartographer UI</title>
	<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
<div class="container mx-auto p-4">
	<!-- Navbar -->
	<nav class="bg-gray-800 p-4">
		<div class="container mx-auto">
			<div class="flex items-center justify-between">
				<div class="text-white text-lg font-bold mr-4">Cartographer UI</div>
				<div class="flex flex-wrap space-x-4">
					{{- range .Groups }}
					<a href="#" class="text-gray-300 hover:text-white">{{.}}</a>
					{{- end }}
				</div>
			</div>
		</div>
	</nav>
	<div class="flex mt-4">
		<!-- Main Content -->
		<div class="w-3/4 p-4">
			<!-- Links -->
			<div class="links mb-4">
				<div class="grid grid-cols-3 gap-4">
				{{- range .Links }}
				<div class="link-card bg-white shadow-md rounded-lg p-4">
					<a href="{{.}}" target="_blank" class="text-blue-500 underline text-lg break-words">{{.}}</a>
					<div class="tags mt-2">
						<ul class="flex space-x-2">
							<li class="bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">tag1</li>
							<li class="bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">tag2</li>
							<li class="bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">tag3</li>
						</ul>
					</div>
				</div>
				{{- end }}
				</div>
			</div>
		</div>
	</div>
</div>
</body>
</html>
`
