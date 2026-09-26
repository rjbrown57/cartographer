package ui

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/backend"
	"github.com/rjbrown57/cartographer/pkg/types/config"
)

type testArchiveService struct {
	imported []byte
	mode     string
	err      error
}

// Export supplies a deterministic payload or simulates an export failure.
func (s *testArchiveService) Export(w io.Writer) error {
	if s.err != nil {
		return s.err
	}
	_, err := io.WriteString(w, "archive content")
	return err
}

// Import captures the uploaded file and explicitly selected mode.
func (s *testArchiveService) Import(r io.Reader, mode string) (*backend.ImportResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	var err error
	s.imported, err = io.ReadAll(r)
	s.mode = mode
	return &backend.ImportResult{Mode: mode, Added: 2, Skipped: 1}, err
}

// archiveUpload builds the documented multipart file request.
func archiveUpload(t *testing.T, mode string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", "backup.tar")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(part, "archive content"); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/admin/import?mode="+mode, &body)
	request.Header.Set("Content-Type", mw.FormDataContentType())
	return request
}

// TestArchiveEndpoints verifies registered routes, session auth, downloads and upload errors.
func TestArchiveEndpoints(t *testing.T) {
	t.Setenv(adminTokenEnv, "secret")
	service := &testArchiveService{}
	router := NewGinServer(nil, &config.WebConfig{}, service)
	for _, request := range []*http.Request{httptest.NewRequest(http.MethodGet, "/v1/admin/export", nil), archiveUpload(t, "replace")} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("unauthenticated request: %d", response.Code)
		}
	}
	login := httptest.NewRecorder()
	router.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/v1/admin/session", strings.NewReader(`{"token":"secret"}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("login: %d", login.Code)
	}
	cookie := login.Result().Cookies()[0]
	export := httptest.NewRequest(http.MethodGet, "/v1/admin/export", nil)
	export.AddCookie(cookie)
	export.Header.Set("Accept-Encoding", "gzip")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, export)
	if response.Code != http.StatusOK || response.Body.String() != "archive content" || response.Header().Get("Content-Type") != "application/x-tar" || response.Header().Get("Content-Encoding") != "" || response.Header().Get("Content-Disposition") == "" {
		t.Fatalf("bad export: %d %v %s", response.Code, response.Header(), response.Body.String())
	}
	for _, mode := range []string{"replace", "merge"} {
		request := archiveUpload(t, mode)
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK || service.mode != mode || string(service.imported) != "archive content" {
			t.Fatalf("bad import: %d %s", response.Code, response.Body.String())
		}
	}
	cases := []struct {
		name    string
		request *http.Request
		err     error
		status  int
	}{
		{"missing mode", archiveUpload(t, ""), nil, http.StatusBadRequest},
		{"unsupported mode", archiveUpload(t, "merge-overwrite"), nil, http.StatusBadRequest},
		{"missing file", httptest.NewRequest(http.MethodPost, "/v1/admin/import?mode=merge", nil), nil, http.StatusBadRequest},
		{"invalid archive", archiveUpload(t, "merge"), backend.ErrInvalidArchive, http.StatusBadRequest},
		{"storage failure", archiveUpload(t, "replace"), errors.New("disk failure"), http.StatusInternalServerError},
		{"failed export", httptest.NewRequest(http.MethodGet, "/v1/admin/export", nil), errors.New("disk failure"), http.StatusInternalServerError},
	}
	oversized := archiveUpload(t, "merge")
	oversized.ContentLength = backend.MaxArchiveBytes + (1 << 20) + 1
	cases = append(cases, struct {
		name    string
		request *http.Request
		err     error
		status  int
	}{"oversized", oversized, nil, http.StatusRequestEntityTooLarge})
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			service.err = tt.err
			tt.request.AddCookie(cookie)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, tt.request)
			if response.Code != tt.status {
				t.Fatalf("got %d want %d: %s", response.Code, tt.status, response.Body.String())
			}
		})
	}
}
