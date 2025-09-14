package ui

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerfiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
	"github.com/rjbrown57/cartographer/pkg/utils"
	"github.com/rjbrown57/cartographer/web"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

// PingHandler godoc
// @Summary Responds with a pong message
// @Description get a simple pong for your ping
// @Tags ping
// @Accept json
// @Produce json
// @Success 200 {string} string "Pong"
// @Router /v1/ping [get]
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

// GetHandler godoc
// @Summary Get all data with optional filtering
// @Description Retrieve all links, groups, and tags with optional filtering by tags, groups and terms via query parameters
// @Tags get
// @Accept json
// @Produce json
// @Param tag query string false "Filter by tag names (comma-separated)" example("oci,k8s")
// @Param group query string false "Filter by group names (comma-separated)" example("gitlab,github")
// @Param term query string false "Filter by term (comma-separated)" example("ko,binman")
// @Success 200 {object} map[string]interface{} "Filtered data"
// @Failure 404 {object} map[string]interface{} "Group not found"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /v1/get [get]
func getFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		gr := &proto.CartographerGetRequest{
			Request: &proto.CartographerRequest{
				Groups: make([]*proto.Group, 0),
				Tags:   make([]*proto.Tag, 0),
			},
			Type: proto.RequestType_REQUEST_TYPE_DATA,
		}

		// Get the group(s) from the query parameter
		for _, group := range SplitQueryArray(c.QueryArray("group")) {
			gr.Request.Groups = append(gr.Request.Groups, &proto.Group{Name: group})
		}

		// Get the tag(s) from the query parameter
		for _, tag := range SplitQueryArray(c.QueryArray("tag")) {
			gr.Request.Tags = append(gr.Request.Tags, &proto.Tag{Name: tag})
		}

		// Get the Terms(s) from the query parameter
		gr.Request.Terms = SplitQueryArray(c.QueryArray("term"))

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

// GetGroupsHandler godoc
// @Summary Get all groups
// @Description Retrieve a list of all available groups
// @Tags get
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of groups"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /v1/get/groups [get]
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

// GetByGroupsHandler godoc
// @Summary Get links by group
// @Description Retrieve links filtered by group name. Can accept additional groups via query parameters.
// @Tags get
// @Accept json
// @Produce json
// @Param group path string true "Group name" example("example-group")
// @Param group query string false "Additional group names (comma-separated)"
// @Success 200 {object} map[string]interface{} "Links filtered by group"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /v1/get/groups/{group} [get]
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

// GetTagsHandler godoc
// @Summary Get all tags
// @Description Retrieve a list of all available tags
// @Tags get
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of tags"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /v1/get/tags [get]
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

// GetByTagsHandler godoc
// @Summary Get links by tag
// @Description Retrieve links filtered by tag name. Can accept additional tags via query parameters.
// @Tags get
// @Accept json
// @Produce json
// @Param tag path string true "Tag name" example("javascript")
// @Param tag query []string false "Additional tag names" collectionFormat(multi)
// @Success 200 {object} map[string]interface{} "Links filtered by tag"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /v1/get/tags/{tag} [get]
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

// IndexHandler godoc
// @Summary Serve the main HTML page
// @Description Serves the main Cartographer web interface
// @Tags web
// @Param tag query []string false "Additional tag names" collectionFormat(multi)
// @Param group query []string false "Additional group names" collectionFormat(multi)
// @Param term query []string false "Additional term names" collectionFormat(multi)
// @Accept html
// @Produce html
// @Success 200 {string} string "HTML page"
// @Router / [get]
func indexFunc(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{"sitename": name})
	}
}

// AboutHandler godoc
// @Summary Get application information
// @Description Retrieve information about the Cartographer application including version, commit, and build date
// @Tags info
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Application information"
// @Router /v1/about [get]
func aboutFunc(siteName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"site": siteName,
			"version":         version,
			"commit":          commit,
			"date":            date,
			"unique_visitors": metrics.GetUniqueVisitorCount(),
		})
	}
}

func faviconFunc() gin.HandlerFunc {
	return func(c *gin.Context) {
		faviconData, err := web.AssetsFS.ReadFile("assets/favicon.ico")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Content-Type", "image/x-icon")
		c.Data(http.StatusOK, "image/x-icon", faviconData)
	}
}

func swaggerFunc() gin.HandlerFunc {
	// https://github.com/swaggo/http-swagger/issues/44
	return func(ctx *gin.Context) {
		// Handle "/docs" and "/docs/"
		if ctx.Param("any") == "" || ctx.Param("any") == "/" {
			ctx.Redirect(http.StatusMovedPermanently, "/docs/index.html")
			return
		}

		ginSwagger.WrapHandler(swaggerfiles.Handler)(ctx)
	}
}
