package ui

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

const (
	adminTokenEnv       = "CARTOGRAPHER_ADMIN_TOKEN"
	adminSessionCookie  = "cartographer_admin_session"
	adminSessionMessage = "cartographer-admin-session"
)

type adminSessionRequest struct {
	Token string `json:"token"`
}

type adminSessionResponse struct {
	Admin      bool `json:"admin"`
	Configured bool `json:"configured"`
}

type adminAuthenticator struct {
	token string
}

// newAdminAuthenticator builds the initial token-based admin authenticator.
func newAdminAuthenticator(webConfig *config.WebConfig) *adminAuthenticator {
	token := ""
	if webConfig != nil {
		token = strings.TrimSpace(webConfig.Auth.AdminToken)
	}
	if envToken := strings.TrimSpace(os.Getenv(adminTokenEnv)); envToken != "" {
		token = envToken
	}

	return &adminAuthenticator{token: token}
}

// configured reports whether admin auth can accept any token.
func (a *adminAuthenticator) configured() bool {
	return a != nil && a.token != ""
}

// authenticateAdminToken validates a supplied admin token.
func (a *adminAuthenticator) authenticateAdminToken(token string) bool {
	if !a.configured() {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(strings.TrimSpace(token)), []byte(a.token)) == 1
}

// sessionValue returns the cookie value for an authenticated admin browser.
func (a *adminAuthenticator) sessionValue() string {
	mac := hmac.New(sha256.New, []byte(a.token))
	_, _ = mac.Write([]byte(adminSessionMessage))
	return hex.EncodeToString(mac.Sum(nil))
}

// isAdminRequest reports whether the request has a valid admin session cookie.
func (a *adminAuthenticator) isAdminRequest(c *gin.Context) bool {
	if !a.configured() {
		return false
	}

	cookie, err := c.Cookie(adminSessionCookie)
	if err != nil {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(cookie), []byte(a.sessionValue())) == 1
}

// setAdminCookie stores an authenticated admin session cookie.
func (a *adminAuthenticator) setAdminCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     adminSessionCookie,
		Value:    a.sessionValue(),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
}

// clearAdminCookie removes the authenticated admin session cookie.
func clearAdminCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     adminSessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   c.Request.TLS != nil,
	})
}

// requireAdmin returns a middleware that gates admin mutation routes.
func requireAdmin(auth *adminAuthenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		if auth.isAdminRequest(c) {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"status": http.StatusUnauthorized, "message": "Admin authentication required"})
	}
}

// getAdminSessionFunc returns the current admin session state.
func getAdminSessionFunc(auth *adminAuthenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, adminSessionResponse{
			Admin:      auth.isAdminRequest(c),
			Configured: auth.configured(),
		})
	}
}

// postAdminSessionFunc exchanges a valid admin token for a session cookie.
func postAdminSessionFunc(auth *adminAuthenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request adminSessionRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid admin session payload"})
			return
		}

		if !auth.configured() {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Admin authentication is not configured"})
			return
		}

		if !auth.authenticateAdminToken(request.Token) {
			c.JSON(http.StatusUnauthorized, gin.H{"status": http.StatusUnauthorized, "message": "Invalid admin token"})
			return
		}

		auth.setAdminCookie(c)
		c.JSON(http.StatusOK, adminSessionResponse{Admin: true, Configured: true})
	}
}

// deleteAdminSessionFunc clears the current admin session.
func deleteAdminSessionFunc() gin.HandlerFunc {
	return func(c *gin.Context) {
		clearAdminCookie(c)
		c.JSON(http.StatusOK, adminSessionResponse{Admin: false, Configured: true})
	}
}
