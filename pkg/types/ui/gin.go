package ui

import (
	"html/template"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rjbrown57/cartographer/pkg/templating"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/config"
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

func NewGinServer(carto *client.CartographerClient, o *config.WebConfig) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	g := gin.New()

	g.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		SkipPaths: []string{"/healthz", "/metrics"},
	}), SiteNameMiddleware(o.SiteName),
		PopulateGroups(carto),
	)

	g.Use(gin.Recovery())

	g.SetHTMLTemplate(template.Must(template.ParseFS(templating.TemplatesFS, "templates/*")))

	// https://github.com/gin-gonic/gin/issues/2809
	// https://github.com/gin-gonic/gin/blob/master/docs/doc.md#dont-trust-all-proxies
	err := g.SetTrustedProxies([]string{"127.0.0.1", "192.168.1.2", "10.0.0.0/8"})
	if err != nil {
		log.Fatal(err)
	}

	// Healthz and Metrics
	g.GET("/healthz", healthzFunc())
	g.GET("/metrics", prometheusHandler())

	// Json Endpoints
	g.GET("/v1/ping", pingFunc(carto))
	g.GET("/v1/get/", getFunc(carto))
	g.GET("/v1/get/tags/:tag", getTagFunc(carto))
	g.GET("/v1/get/groups/:group", getGroupFunc(carto))
	g.GET("/v1/get/tags", getTagFunc(carto))
	g.GET("/v1/get/groups", getGroupFunc(carto))

	// HTML Endpoints
	g.GET("/", getFunc(carto))
	g.GET("/tags/", getTagFunc(carto))
	g.GET("/tags/:tag", getTagFunc(carto))
	g.GET("/groups/", getGroupFunc(carto))
	g.GET("/groups/:group", getGroupFunc(carto))

	return g
}
