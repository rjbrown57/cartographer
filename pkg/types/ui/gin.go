package ui

import (
	"html/template"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/web"

	// Swagger
	docs "github.com/rjbrown57/cartographer/pkg/types/ui/docs"
)

func prometheusHandler() gin.HandlerFunc {
	h := promhttp.Handler()

	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func healthzFunc() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.String(http.StatusOK, "%s", "ok")
	}
}

// @title Cartographer Swagger API
// @version 1.0
// @description Cartographer Swagger API
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url https://github.com/rjbrown57/cartographer
// @contact.email rjbrown57@gmail.com

// @BasePath /v1
// @schemes http,https

var excludePaths = []string{"/healthz", "/metrics", "/v1/ping"}

func NewGinServer(carto *client.CartographerClient, o *config.WebConfig) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	g := gin.New()

	g.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Skip: GetSkipper(),
	}), SiteNameMiddleware(o.SiteName),
		TrackingMiddleware(),
		gin.Recovery(),
		gzip.Gzip(gzip.DefaultCompression,
			gzip.WithExcludedPaths(excludePaths)))

	g.SetHTMLTemplate(template.Must(template.ParseFS(web.HtmlFS, "html/*")))
	g.StaticFS("/scripts/", http.FS(web.GetJSFS()))

	// https://github.com/gin-gonic/gin/issues/2809
	// https://github.com/gin-gonic/gin/blob/master/docs/doc.md#dont-trust-all-proxies
	err := g.SetTrustedProxies([]string{"127.0.0.1", "192.168.1.2", "10.0.0.0/8"})
	if err != nil {
		log.Fatalf("%s", err)
	}

	SwaggerConfig(o)

	// Swagger docs
	g.GET("/docs/*any", swaggerFunc())
	g.GET("/swagger-ui/*any", swaggerFunc())
	g.GET("/swagger/*any", swaggerFunc())

	// handle unknown routes with 404
	g.NoRoute(NoRouteFunc())

	// Healthz and Metrics
	g.GET("/healthz", healthzFunc())
	g.GET("/metrics", prometheusHandler())

	// Global favicon route - browsers automatically request this
	g.GET("/favicon.ico", faviconFunc())

	// Json Endpoints
	g.GET("/v1/ping", pingFunc(carto))
	g.GET("/v1/get", getFunc(carto))
	g.GET("/v1/get/tags", getTagsFunc(carto))
	g.GET("/v1/get/groups", getGroupsFunc(carto))
	g.GET("/v1/get/namespaces", getNamespacesFunc(carto))
	g.GET("/v1/get/tags/:tag", getByTagsFunc(carto))
	g.GET("/v1/get/groups/:group", getByGroupsFunc(carto))
	g.GET("/v1/about", aboutFunc(o.SiteName))

	// HTML Endpoints
	g.GET("/", indexFunc(o.SiteName))
	return g
}

func NoRouteFunc() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Page not found"})
	}
}

func GetSkipper() func(c *gin.Context) bool {
	return func(c *gin.Context) bool {
		// Exact Path Matches
		switch c.Request.URL.Path {
		case "/healthz", "/metrics", "/v1/ping":
			return true
		}

		// Prefix Matches
		if strings.HasPrefix(c.Request.URL.Path, "/scripts") {
			return true
		}

		return false
	}
}

func SwaggerConfig(_ *config.WebConfig) {
	swaggerHost := os.Getenv("SWAGGER_HOST")
	docs.SwaggerInfo.Host = swaggerHost

	swaggerScheme := os.Getenv("SWAGGER_SCHEME")
	if swaggerScheme != "" {
		docs.SwaggerInfo.Schemes = []string{swaggerScheme}
		return
	}

	docs.SwaggerInfo.Schemes = []string{}
}
