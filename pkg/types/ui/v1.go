package ui

import (
	"net/http"

	"github.com/gin-gonic/gin"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
)

func pingFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		pr, err := carto.Client.Ping(carto.Ctx, &proto.PingRequest{Name: c.ClientIP()})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.String(http.StatusOK, "%s", pr.GetMessage())
	}
}

func getFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		gr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{},
			Type:    proto.RequestType_REQUEST_TYPE_DATA,
		}
		pr, err := carto.Client.Get(carto.Ctx, gr)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

func getGroupFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{},
			Type:    proto.RequestType_REQUEST_TYPE_GROUP,
		}

		if c.Param("group") != "" {
			g := make([]*proto.Group, 0)
			cr.Request.Groups = append(g, &proto.Group{Name: c.Param("group")})
			cr.Type = proto.RequestType_REQUEST_TYPE_DATA
		}

		pr, err := carto.Client.Get(carto.Ctx, cr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

func getTagFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{},
			Type:    proto.RequestType_REQUEST_TYPE_TAG,
		}

		if c.Param("tag") != "" {
			t := make([]*proto.Tag, 0)
			cr.Request.Tags = append(t, &proto.Tag{Name: c.Param("tag")})
			cr.Type = proto.RequestType_REQUEST_TYPE_DATA
		}

		pr, err := carto.Client.Get(carto.Ctx, cr)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
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
