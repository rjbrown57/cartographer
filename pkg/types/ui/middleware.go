package ui

import (
	"log"
	"strings"

	"github.com/gin-gonic/gin"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

func SiteNameMiddleware(siteName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("sitename", siteName)
		c.Next()
	}
}

// PopulateGroups will get all groups from the cartographer service and set them in the context if required by the request
// Currently this is only required for the root, /v1/tags and /v1/groups endpoints
func PopulateGroups(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		switch {
		case c.Request.RequestURI == "/":
			fallthrough
		case strings.HasPrefix(c.Request.RequestURI, "/v1/"):
			c.Next()
		}

		r, err := carto.Client.Get(*carto.Ctx, &proto.CartographerRequest{Type: proto.RequestType_GROUP})
		if err != nil {
			log.Printf("Error getting groups %s", err)
			c.Next()
		}
		c.Set("Groups", r.GetGroups())
		c.Next()
	}
}
