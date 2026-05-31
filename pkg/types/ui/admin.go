package ui

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

const (
	adminNamespace      = "cartographer-admin"
	templateKeyPrefix   = "template/"
	templateSource      = "cartographer-admin"
	templateAuthor      = "cartographer"
	templateDataDescKey = "description"
)

var templateSlugCleanup = regexp.MustCompile(`[^a-z0-9-]+`)

type markdownTemplate struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Body        string    `json:"body"`
	Tags        []string  `json:"tags"`
	Source      string    `json:"source,omitempty"`
	Author      string    `json:"author,omitempty"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
	Version     int64     `json:"version,omitempty"`
}

type templateListResponse struct {
	Templates []markdownTemplate `json:"templates"`
}

// getTemplatesFunc returns reusable markdown templates from admin storage.
func getTemplatesFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		templates, err := listMarkdownTemplates(carto.Ctx, carto)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Unable to list templates"})
			return
		}

		c.JSON(http.StatusOK, templateListResponse{Templates: templates})
	}
}

// postTemplatesFunc creates or updates a reusable markdown template.
func postTemplatesFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		var template markdownTemplate
		if err := c.ShouldBindJSON(&template); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid template payload"})
			return
		}

		if err := validateMarkdownTemplate(template); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": err.Error()})
			return
		}

		note, err := templateToNote(template)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": err.Error()})
			return
		}

		resp, err := carto.Client.Add(carto.Ctx, &proto.CartographerAddRequest{
			Request: &proto.CartographerRequest{
				Namespace: adminNamespace,
				Notes:     []*proto.Note{note},
			},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Unable to save template"})
			return
		}

		notes := resp.GetResponse().GetNotes()
		if len(notes) == 0 {
			c.JSON(http.StatusCreated, template)
			return
		}

		c.JSON(http.StatusCreated, noteToTemplate(notes[0]))
	}
}

// deleteTemplatesFunc removes a reusable markdown template from admin storage.
func deleteTemplatesFunc(carto *client.CartographerClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := templateNoteID(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": err.Error()})
			return
		}

		if _, err := carto.Client.Delete(carto.Ctx, &proto.CartographerDeleteRequest{
			Ids:       []string{id},
			Namespace: adminNamespace,
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Unable to delete template"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Template deleted"})
	}
}

// listMarkdownTemplates reads template notes from the reserved admin namespace.
func listMarkdownTemplates(ctx context.Context, carto *client.CartographerClient) ([]markdownTemplate, error) {
	resp, err := carto.Client.Get(ctx, &proto.CartographerGetRequest{
		Request: &proto.CartographerRequest{
			Namespace: adminNamespace,
		},
		Type: proto.RequestType_REQUEST_TYPE_DATA,
	})
	if err != nil {
		return nil, err
	}

	templates := make([]markdownTemplate, 0)
	for _, note := range resp.GetResponse().GetNotes() {
		if !strings.HasPrefix(note.GetId(), templateKeyPrefix) {
			continue
		}
		templates = append(templates, noteToTemplate(note))
	}

	slices.SortFunc(templates, func(a, b markdownTemplate) int {
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})
	return templates, nil
}

// validateMarkdownTemplate checks the minimal fields required to save a template.
func validateMarkdownTemplate(template markdownTemplate) error {
	if strings.TrimSpace(template.Name) == "" {
		return fmt.Errorf("template name is required")
	}
	if strings.TrimSpace(template.Body) == "" {
		return fmt.Errorf("template markdown body is required")
	}
	return nil
}

// templateToNote converts an admin template payload into an internal note record.
func templateToNote(template markdownTemplate) (*proto.Note, error) {
	id, err := templateNoteID(template.ID)
	if err != nil {
		if strings.TrimSpace(template.ID) != "" {
			return nil, err
		}
		id = templateID(template.Name)
	}

	return proto.NewNoteBuilder().
		WithId(id).
		WithTitle(strings.TrimSpace(template.Name)).
		WithBody(strings.TrimSpace(template.Body)).
		WithTags(cleanTemplateTags(template.Tags)).
		WithData(map[string]any{templateDataDescKey: strings.TrimSpace(template.Description)}).
		WithCreatedAt(template.CreatedAt).
		WithUpdatedAt(template.UpdatedAt).
		WithSource(defaultString(template.Source, templateSource)).
		WithAuthor(defaultString(template.Author, templateAuthor)).
		WithVersion(template.Version).
		Build()
}

// noteToTemplate converts an internal template note into the admin API shape.
func noteToTemplate(note *proto.Note) markdownTemplate {
	template := markdownTemplate{
		ID:        strings.TrimPrefix(note.GetId(), templateKeyPrefix),
		Name:      note.GetTitle(),
		Body:      note.GetBody(),
		Tags:      note.GetTags(),
		Source:    note.GetSource(),
		Author:    note.GetAuthor(),
		Version:   note.GetVersion(),
		CreatedAt: timestampAsTime(note.GetCreatedAt()),
		UpdatedAt: timestampAsTime(note.GetUpdatedAt()),
	}

	if data := note.GetData(); data != nil {
		if description, ok := data.AsMap()[templateDataDescKey].(string); ok {
			template.Description = description
		}
	}

	return template
}

// templateID returns a stable-ish readable key with a random suffix.
func templateID(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = templateSlugCleanup.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "template"
	}
	return templateKeyPrefix + slug + "-" + uuid.NewString()
}

// templateNoteID normalizes a public template id into its reserved note id.
func templateNoteID(id string) (string, error) {
	cleaned := strings.TrimSpace(id)
	if cleaned == "" {
		return "", fmt.Errorf("template id is required")
	}
	if strings.HasPrefix(cleaned, templateKeyPrefix) {
		cleaned = strings.TrimPrefix(cleaned, templateKeyPrefix)
	}
	if strings.Contains(cleaned, "/") {
		return "", fmt.Errorf("template id is invalid")
	}
	return templateKeyPrefix + cleaned, nil
}

// cleanTemplateTags trims empty template tag defaults.
func cleanTemplateTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	for _, tag := range tags {
		cleaned := strings.TrimSpace(tag)
		if cleaned != "" {
			out = append(out, cleaned)
		}
	}
	return out
}

// defaultString returns fallback when value is empty.
func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

// timestampAsTime converts an optional protobuf timestamp into time.Time.
func timestampAsTime(timestamp *timestamppb.Timestamp) time.Time {
	if timestamp == nil {
		return time.Time{}
	}
	return timestamp.AsTime()
}
