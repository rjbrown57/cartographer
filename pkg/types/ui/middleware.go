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

// isLikelyBrowserRequest identifies requests likely originating from an interactive browser.
func isLikelyBrowserRequest(c *gin.Context) bool {

	// check common browser used headers if set return true to indicate this is a browser session
	for _, header := range []string{"Sec-Fetch-Mode", "Sec-Fetch-Site", "Sec-Fetch-Dest", "User-Agent"} {
		if c.GetHeader(header) != "" {
			return true
		}
	}

	return false
}

// TrackingMiddleware tracks unique visitors while excluding non-user-facing endpoints.
func TrackingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Exclude healthz and metrics.
		if slices.Contains(excludePaths, c.Request.URL.Path) {
			c.Next()
			return
		}

		// Ignore requests that do not look like a browser to avoid bot/probe/API skew.
		if !isLikelyBrowserRequest(c) {
			c.Next()
			return
		}

		metrics.Metrics().TrackUniqueVisitor(visitorIDFromRequest(c), "web-ui")
		c.Next()
	}
}
