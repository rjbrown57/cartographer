package ui

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/types/metrics"
)

// setBrowserHeaders adds minimal browser-like headers for middleware detection.
func setBrowserHeaders(r *http.Request) {
	r.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
	r.Header.Set("Sec-Fetch-Mode", "navigate")
}

// TestTrackingMiddlewareSetsVisitorCookie validates that tracking creates a stable visitor cookie.
func TestTrackingMiddlewareSetsVisitorCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.Metrics().ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	setBrowserHeaders(req)
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

	if metrics.Metrics().GetUniqueVisitorCount() != 1 {
		t.Fatalf("Expected one unique visitor, got %f", metrics.Metrics().GetUniqueVisitorCount())
	}
}

// TestTrackingMiddlewareReusesVisitorCookie validates existing visitor IDs are reused.
func TestTrackingMiddlewareReusesVisitorCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.Metrics().ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	requestCookie := &http.Cookie{Name: visitorCookieName, Value: "visitor-fixed"}

	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	setBrowserHeaders(req1)
	req1.AddCookie(requestCookie)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	setBrowserHeaders(req2)
	req2.AddCookie(requestCookie)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if metrics.Metrics().GetUniqueVisitorCount() != 1 {
		t.Fatalf("Expected one unique visitor, got %f", metrics.Metrics().GetUniqueVisitorCount())
	}
}

// TestTrackingMiddlewareSkipsExcludedPaths validates excluded routes are not tracked.
func TestTrackingMiddlewareSkipsExcludedPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	metrics.Metrics().ClearVisitors()

	router := gin.New()
	router.Use(TrackingMiddleware())
	router.GET("/metrics", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	setBrowserHeaders(req)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	if metrics.Metrics().GetUniqueVisitorCount() != 0 {
		t.Fatalf("Expected zero unique visitors, got %f", metrics.Metrics().GetUniqueVisitorCount())
	}
}

// TestTrackingMiddlewareSkipsNonBrowserRequests validates non-browser traffic is not tracked.
func TestTrackingMiddlewareSkipsNonBrowserRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		headers    map[string]string
		wantStatus int
	}{
		{
			name:       "no headers",
			headers:    map[string]string{},
			wantStatus: http.StatusOK,
		},
		{
			name: "custom non-browser header only",
			headers: map[string]string{
				"X-Probe": "kube-probe/1.30",
			},
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metrics.Metrics().ClearVisitors()

			router := gin.New()
			router.Use(TrackingMiddleware())
			router.GET("/", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Fatalf("Expected status %d, got %d", tt.wantStatus, w.Code)
			}

			if metrics.Metrics().GetUniqueVisitorCount() != 0 {
				t.Fatalf("Expected zero unique visitors, got %f", metrics.Metrics().GetUniqueVisitorCount())
			}

			if len(w.Result().Cookies()) != 0 {
				t.Fatal("Expected no visitor cookie to be set for non-browser traffic")
			}
		})
	}
}
