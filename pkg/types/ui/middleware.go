package ui

import (
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

const visitorCookieName = "cartographer_visitor_id"
const cookieAge = 60 * 60 * 24 * 365

// SiteNameMiddleware stores a configured site name on the request context.
func SiteNameMiddleware(siteName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("sitename", siteName)
		c.Next()
	}
}

// visitorIDFromRequest returns a stable visitor identifier from a first-party cookie.
func visitorIDFromRequest(c *gin.Context) string {
	visitorID, err := c.Cookie(visitorCookieName)
	if err == nil && visitorID != "" {
		return visitorID
	}

	newVisitorID := uuid.NewString()

	secure := c.Request.TLS != nil
	// Persist the generated ID for one year so repeat browser visits can be deduplicated.
	c.SetCookie(visitorCookieName, newVisitorID, cookieAge, "/", "", secure, true)

	return newVisitorID
}

// TrackingMiddleware tracks unique visitors while excluding non-user-facing endpoints.
func TrackingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Exclude healthz and metrics.
		if slices.Contains(excludePaths, c.Request.URL.Path) {
			c.Next()
			return
		}

		metrics.TrackUniqueVisitor(visitorIDFromRequest(c), "web-ui")
		c.Next()
	}
}
