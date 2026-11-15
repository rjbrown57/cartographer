package ui

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/web"
)

// TestPageHandlersRenderDistinctShells verifies desktop and mobile use separate entrypoints.
func TestPageHandlersRenderDistinctShells(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.SetHTMLTemplate(template.Must(template.ParseFS(web.HtmlFS, "html/*")))
	router.GET("/", reactDesktopPageFunc("Cartographer Test"))
	router.GET("/legacy", indexFunc("Cartographer Test"))
	router.GET("/react-preview", reactDesktopPageFunc("Cartographer Test"))
	router.GET("/mobile", reactMobilePageFunc("Cartographer Test"))
	router.GET("/legacy-mobile", mobilePageFunc("Cartographer Test"))
	router.GET("/note", reactNotePageFunc("Cartographer Test"))
	router.GET("/legacy-note", notePageFunc("Cartographer Test"))

	tests := []struct {
		name       string
		path       string
		entrypoint string
		excluded   string
	}{
		{name: "desktop", path: "/", entrypoint: "scripts/react/desktop.js", excluded: "scripts/cartographer.js"},
		{name: "legacy", path: "/legacy", entrypoint: "scripts/cartographer.js", excluded: "scripts/react/desktop.js"},
		{name: "mobile", path: "/mobile", entrypoint: "scripts/react/mobile.js", excluded: "scripts/mobile/app.js"},
		{name: "legacy mobile", path: "/legacy-mobile", entrypoint: "scripts/mobile/app.js", excluded: "scripts/react/mobile.js"},
		{name: "React preview", path: "/react-preview", entrypoint: "scripts/react/desktop.js", excluded: "scripts/cartographer.js"},
		{name: "note", path: "/note", entrypoint: "scripts/react/note.js", excluded: "scripts/note.js"},
		{name: "legacy note", path: "/legacy-note", entrypoint: "scripts/note.js", excluded: "scripts/react/note.js"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d", response.Code)
			}
			body := response.Body.String()
			if !strings.Contains(body, test.entrypoint) {
				t.Fatalf("expected %s shell to include %q", test.name, test.entrypoint)
			}
			if strings.Contains(body, test.excluded) {
				t.Fatalf("expected %s shell to exclude %q", test.name, test.excluded)
			}
		})
	}
}
