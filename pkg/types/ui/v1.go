package ui

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
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
			Request: &proto.CartographerRequest{
				Groups: make([]*proto.Group, 0),
				Tags:   make([]*proto.Tag, 0),
			},
			Type: proto.RequestType_REQUEST_TYPE_DATA,
		}

		// Get the group from the query parameter
		for _, group := range c.QueryArray("group") {
			gr.Request.Groups = append(gr.Request.Groups, &proto.Group{Name: group})
		}

		// Get the tag from the query parameter
		for _, tag := range c.QueryArray("tag") {
			gr.Request.Tags = append(gr.Request.Tags, &proto.Tag{Name: tag})
		}

		pr, err := carto.Client.Get(carto.Ctx, gr)

		if err != nil {
			if errors.Is(err, utils.GroupNotFoundError) {
				c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Group not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

// getGroupFunc is a handler for the /v1/get/groups endpoint
// it will return a list of groups
func getGroupsFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{},
			Type:    proto.RequestType_REQUEST_TYPE_GROUP,
		}

		pr, err := carto.Client.Get(carto.Ctx, cr)
		if err != nil {
			// need to handle known errors here
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

// getByGroupsFunc is a handler for the /v1/get/groups/:group endpoint
// it will return a list of links by group
func getByGroupsFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{
				Groups: make([]*proto.Group, 0),
			},
			Type: proto.RequestType_REQUEST_TYPE_DATA,
		}

		// Get the group from the path parameter
		group := c.Param("group")
		cr.Request.Groups = append(cr.Request.Groups, &proto.Group{Name: group})

		// Get the group from the query parameter
		for _, group := range c.QueryArray("group") {
			cr.Request.Groups = append(cr.Request.Groups, &proto.Group{Name: group})
		}

		pr, err := carto.Client.Get(carto.Ctx, cr)
		if err != nil {
			// need to handle known errors here
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

// getTagsFunc is a handler for the /v1/get/tags endpoint
// it will return a list of known tags
func getTagsFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{},
			Type:    proto.RequestType_REQUEST_TYPE_TAG,
		}

		pr, err := carto.Client.Get(carto.Ctx, cr)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Internal Server Error"})
			return
		}

		c.JSON(http.StatusOK, pr)
	}
}

// getByTagsFunc is a handler for the /v1/get/tags/:tag endpoint
// it will return a list of links by tag
func getByTagsFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {

		cr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{
				Tags: make([]*proto.Tag, 0),
			},
			Type: proto.RequestType_REQUEST_TYPE_DATA,
		}

		// Get the tag from the path parameter
		tag := c.Param("tag")
		cr.Request.Tags = append(cr.Request.Tags, &proto.Tag{Name: tag})

		// Get the tag from the query parameter
		for _, tag := range c.QueryArray("tag") {
			cr.Request.Tags = append(cr.Request.Tags, &proto.Tag{Name: tag})
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

func aboutFunc(siteName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"site": siteName,
			"version": version,
			"commit":  commit,
			"date":    date,
		})
	}
}
