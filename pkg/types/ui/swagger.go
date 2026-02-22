package ui

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	docs "github.com/rjbrown57/cartographer/pkg/types/ui/docs"
)

// serveSwaggerDoc serves a per-request swagger document that honors proxy headers.
func serveSwaggerDoc(ctx *gin.Context) {
	rawDoc := docs.SwaggerInfo.ReadDoc()

	swaggerDoc := map[string]interface{}{}
	if err := json.Unmarshal([]byte(rawDoc), &swaggerDoc); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "unable to render swagger document"})
		return
	}

	host := docs.SwaggerInfo.Host
	if host == "" {
		host = requestHost(ctx)
	}

	if host == "" {
		delete(swaggerDoc, "host")
	} else {
		swaggerDoc["host"] = host
	}

	schemes := docs.SwaggerInfo.Schemes
	if len(schemes) == 0 {
		if scheme := requestScheme(ctx); scheme != "" {
			schemes = []string{scheme}
		}
	}

	if len(schemes) == 0 {
		delete(swaggerDoc, "schemes")
	} else {
		swaggerDoc["schemes"] = schemes
	}

	ctx.JSON(http.StatusOK, swaggerDoc)
}

// requestHost extracts the externally visible host from standard proxy headers.
func requestHost(ctx *gin.Context) string {
	if host := firstCommaToken(ctx.GetHeader("X-Forwarded-Host")); host != "" {
		return host
	}

	if host := firstCommaToken(forwardedHeaderValue(ctx.GetHeader("Forwarded"), "host")); host != "" {
		return host
	}

	return firstCommaToken(ctx.Request.Host)
}

// requestScheme extracts the externally visible scheme from standard proxy headers.
func requestScheme(ctx *gin.Context) string {
	if scheme := firstCommaToken(ctx.GetHeader("X-Forwarded-Proto")); scheme != "" {
		return strings.ToLower(scheme)
	}

	if scheme := firstCommaToken(forwardedHeaderValue(ctx.GetHeader("Forwarded"), "proto")); scheme != "" {
		return strings.ToLower(scheme)
	}

	if ctx.Request.TLS != nil {
		return "https"
	}

	return "http"
}

// forwardedHeaderValue parses a key from an RFC 7239 Forwarded header.
func forwardedHeaderValue(header, key string) string {
	if header == "" {
		return ""
	}

	firstForwardedEntry := firstCommaToken(header)
	for _, segment := range strings.Split(firstForwardedEntry, ";") {
		part := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(part) != 2 {
			continue
		}
		if !strings.EqualFold(part[0], key) {
			continue
		}

		return strings.Trim(part[1], "\"")
	}

	return ""
}

// firstCommaToken returns the first value from comma-separated headers.
func firstCommaToken(value string) string {
	for _, part := range strings.Split(value, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			return trimmed
		}
	}

	return ""
}
