package ui

import (
	"net/http"

	"github.com/gin-gonic/gin"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

func pingFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		pr, err := carto.Client.Ping(*carto.Ctx, &proto.PingRequest{Name: c.ClientIP()})

		if err != nil {
			c.HTML(http.StatusInternalServerError, "error.tmpl", NewErrorHeaders(c, http.StatusInternalServerError, err))
			return
		}

		c.String(http.StatusOK, "%s", pr.GetMessage())
	}
}

func getFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		pr, err := carto.Client.Get(*carto.Ctx, &proto.CartographerRequest{})

		if err != nil {
			c.HTML(http.StatusInternalServerError, "error.tmpl", NewErrorHeaders(c, http.StatusInternalServerError, err))
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

func getGroupFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerRequest{
			Type: proto.RequestType_GROUP,
		}

		if c.Param("group") != "" {
			g := make([]*proto.Group, 0)
			cr.Groups = append(g, &proto.Group{Name: c.Param("group")})
			cr.Type = proto.RequestType_DATA
		}

		pr, err := carto.Client.Get(*carto.Ctx, cr)
		if err != nil {
			c.HTML(http.StatusInternalServerError, "error.tmpl", NewErrorHeaders(c, http.StatusInternalServerError, err))
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

func getTagFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerRequest{
			Type: proto.RequestType_TAG,
		}

		if c.Param("tag") != "" {
			t := make([]*proto.Tag, 0)
			cr.Tags = append(t, &proto.Tag{Name: c.Param("tag")})
			cr.Type = proto.RequestType_DATA
		}

		pr, err := carto.Client.Get(*carto.Ctx, cr)

		if err != nil {
			c.HTML(http.StatusInternalServerError, "error.tmpl", NewErrorHeaders(c, http.StatusInternalServerError, err))
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

func indexFunc(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{"sitename": name})
	}
}
