package ui

import (
	"html/template"
	"log"
	"net/http"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/web"
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
		SkipPaths: []string{"/healthz", "/metrics", "/v1/ping"},
	}), SiteNameMiddleware(o.SiteName),
		gin.Recovery(),
		gzip.Gzip(gzip.DefaultCompression,
			gzip.WithExcludedPaths([]string{"/healthz", "/metrics", "/v1/ping"})))

	g.SetHTMLTemplate(template.Must(template.ParseFS(web.HtmlFS, "html/*")))
	g.StaticFileFS("scripts/cartographer.js", "js/cartographer.js", http.FS(web.JsFS))

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
	g.GET("/v1/get", getFunc(carto))
	g.GET("/v1/get/tags/:tag", getTagFunc(carto))
	g.GET("/v1/get/groups/:group", getGroupFunc(carto))
	g.GET("/v1/get/tags", getTagFunc(carto))
	g.GET("/v1/get/groups", getGroupFunc(carto))

	// HTML Endpoints
	g.GET("/", indexFunc(o.SiteName))
	return g
}
