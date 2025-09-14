package ui

import (
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

func SiteNameMiddleware(siteName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("sitename", siteName)
		c.Next()
	}
}

func TrackingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Exclude healthz and metrics
		if slices.Contains(excludePaths, c.Request.URL.Path) {
			c.Next()
			return
		}

		metrics.TrackUniqueVisitor(c.ClientIP(), "web-ui")
		c.Next()
	}
}
