package ui

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

// TestTrackingMiddlewareSetsVisitorCookie validates that tracking creates a stable visitor cookie.
func TestTrackingMiddlewareSetsVisitorCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	response := w.Result()
	defer response.Body.Close()

	cookies := response.Cookies()
	if len(cookies) == 0 {
		t.Fatal("Expected visitor cookie to be set")
	}

	if cookies[0].Name != visitorCookieName {
		t.Fatalf("Expected cookie name %q, got %q", visitorCookieName, cookies[0].Name)
	}

	if metrics.GetUniqueVisitorCount() != 1 {
		t.Fatalf("Expected one unique visitor, got %f", metrics.GetUniqueVisitorCount())
	}
}

// TestTrackingMiddlewareReusesVisitorCookie validates existing visitor IDs are reused.
func TestTrackingMiddlewareReusesVisitorCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	requestCookie := &http.Cookie{Name: visitorCookieName, Value: "visitor-fixed"}

	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	req1.AddCookie(requestCookie)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.AddCookie(requestCookie)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if metrics.GetUniqueVisitorCount() != 1 {
		t.Fatalf("Expected one unique visitor, got %f", metrics.GetUniqueVisitorCount())
	}
}

// TestTrackingMiddlewareSkipsExcludedPaths validates excluded routes are not tracked.
func TestTrackingMiddlewareSkipsExcludedPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/metrics", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	if metrics.GetUniqueVisitorCount() != 0 {
		t.Fatalf("Expected zero unique visitors, got %f", metrics.GetUniqueVisitorCount())
	}
}
