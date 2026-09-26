package ui

import (
	"errors"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/backend"
)

// exportFunc downloads a complete archive after successfully staging it on disk.
// @Summary Export the complete database
// @Description Requires an admin session cookie from POST /v1/admin/session. Downloads an uncompressed, versioned tar containing all namespaces, templates and database metadata. Maximum archive size is 256 MiB.
// @Tags admin
// @Produce application/x-tar
// @Success 200 {file} file "Database archive"
// @Failure 401 {object} map[string]interface{} "Admin authentication required"
// @Failure 500 {object} map[string]interface{} "Export failed"
// @Router /v1/admin/export [get]
func exportFunc(service backend.ArchiveService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if service == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Archive service unavailable"})
			return
		}
		file, err := os.CreateTemp("", "cartographer-export-*.tar")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to stage export"})
			return
		}
		defer os.Remove(file.Name())
		defer file.Close()
		if err := service.Export(file); err != nil {
			log.Errorf("Export database: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to export database"})
			return
		}
		if _, err := file.Seek(0, 0); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to read export"})
			return
		}
		info, err := file.Stat()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to read export"})
			return
		}
		c.Header("Content-Disposition", `attachment; filename="cartographer.tar"`)
		c.Header("Cache-Control", "no-store")
		c.DataFromReader(http.StatusOK, info.Size(), "application/x-tar", file, nil)
	}
}

// importFunc validates an uploaded archive and restores it using the explicit import mode.
// @Summary Import a database archive
// @Description Requires an admin session cookie from POST /v1/admin/session. replace removes existing contents; merge adds missing records and keeps existing namespace/key matches, including templates. Values and lifecycle metadata are preserved. Invalid archives leave the database unchanged. Maximum file size is 256 MiB; multipart overhead is limited to 1 MiB. Counts cover records under data_store; added includes every restored record in replace mode.
// @Tags admin
// @Accept multipart/form-data
// @Produce json
// @Param mode query string true "Import mode" Enums(replace,merge)
// @Param file formData file true "Tar archive returned by export"
// @Success 200 {object} backend.ImportResult
// @Failure 400 {object} map[string]interface{} "Invalid archive, upload or mode"
// @Failure 401 {object} map[string]interface{} "Admin authentication required"
// @Failure 413 {object} map[string]interface{} "Upload too large"
// @Failure 500 {object} map[string]interface{} "Import failed"
// @Router /v1/admin/import [post]
func importFunc(service backend.ArchiveService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mode := c.Query("mode")
		if mode != "replace" && mode != "merge" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "mode must be replace or merge"})
			return
		}
		if service == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Archive service unavailable"})
			return
		}
		if c.Request.ContentLength > backend.MaxArchiveBytes+(1<<20) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"message": "Upload exceeds size limit"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, backend.MaxArchiveBytes+(1<<20))
		err := c.Request.ParseMultipartForm(1 << 20)
		if c.Request.MultipartForm != nil {
			defer c.Request.MultipartForm.RemoveAll()
		}
		if err != nil {
			var limitErr *http.MaxBytesError
			status := http.StatusBadRequest
			if errors.As(err, &limitErr) {
				status = http.StatusRequestEntityTooLarge
			}
			c.JSON(status, gin.H{"message": "Invalid or oversized multipart upload"})
			return
		}
		files := c.Request.MultipartForm.File["file"]
		if len(files) != 1 || len(c.Request.MultipartForm.File) != 1 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Supply exactly one file field"})
			return
		}
		if files[0].Size > backend.MaxArchiveBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"message": "Archive exceeds 256 MiB limit"})
			return
		}
		file, err := files[0].Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to open upload"})
			return
		}
		defer file.Close()
		result, err := service.Import(file, mode)
		if err != nil {
			if errors.Is(err, backend.ErrInvalidArchive) {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			log.Errorf("Import database: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Unable to import database"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}
