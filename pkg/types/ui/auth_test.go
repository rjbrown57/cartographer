package ui

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

// TestAdminAuthenticatorUsesConfigAndEnv verifies token source precedence.
func TestAdminAuthenticatorUsesConfigAndEnv(t *testing.T) {
	t.Setenv(adminTokenEnv, "")

	auth := newAdminAuthenticator(&config.WebConfig{Auth: config.AuthConfig{AdminToken: "from-config"}})
	if !auth.authenticateAdminToken("from-config") {
		t.Fatal("expected config token to authenticate")
	}

	t.Setenv(adminTokenEnv, "from-env")
	auth = newAdminAuthenticator(&config.WebConfig{Auth: config.AuthConfig{AdminToken: "from-config"}})
	if !auth.authenticateAdminToken("from-env") {
		t.Fatal("expected env token to authenticate")
	}
	if auth.authenticateAdminToken("from-config") {
		t.Fatal("expected env token to override config token")
	}
}

// TestAdminSessionEndpoints verifies token exchange and session clearing.
func TestAdminSessionEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := &adminAuthenticator{token: "secret"}
	router := gin.New()
	router.GET("/session", getAdminSessionFunc(auth))
	router.POST("/session", postAdminSessionFunc(auth))
	router.DELETE("/session", deleteAdminSessionFunc())
	router.POST("/admin", requireAdmin(auth), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	unauthenticated := httptest.NewRecorder()
	router.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodPost, "/admin", nil))
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated admin request to fail, got %d", unauthenticated.Code)
	}

	login := httptest.NewRecorder()
	router.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/session", strings.NewReader(`{"token":"secret"}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("expected login to succeed, got %d", login.Code)
	}
	cookies := login.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != adminSessionCookie || !cookies[0].HttpOnly {
		t.Fatalf("expected http-only admin session cookie, got %v", cookies)
	}

	admin := httptest.NewRecorder()
	adminRequest := httptest.NewRequest(http.MethodPost, "/admin", nil)
	adminRequest.AddCookie(cookies[0])
	router.ServeHTTP(admin, adminRequest)
	if admin.Code != http.StatusNoContent {
		t.Fatalf("expected authenticated admin request to pass, got %d", admin.Code)
	}

	logout := httptest.NewRecorder()
	router.ServeHTTP(logout, httptest.NewRequest(http.MethodDelete, "/session", nil))
	if logout.Code != http.StatusOK {
		t.Fatalf("expected logout to succeed, got %d", logout.Code)
	}
}

// TestAdminSessionRejectsUnconfiguredToken verifies closed admin behavior without config.
func TestAdminSessionRejectsUnconfiguredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/session", postAdminSessionFunc(&adminAuthenticator{}))

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodPost, "/session", strings.NewReader(`{"token":"secret"}`)))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected unconfigured auth to be forbidden, got %d", resp.Code)
	}
}
