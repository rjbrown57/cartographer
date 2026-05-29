package proto

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/rjbrown57/cartographer/pkg/log"
	structpb "google.golang.org/protobuf/types/known/structpb"
)

// NoteBuilder is a builder for proto.Note.
type NoteBuilder struct {
	note *Note
}

// NewNoteBuilder creates a new NoteBuilder.
func NewNoteBuilder() *NoteBuilder {
	return &NoteBuilder{
		note: &Note{},
	}
}

// NewLinkBuilder creates a legacy URL-first note builder.
func NewLinkBuilder() *NoteBuilder {
	return NewNoteBuilder()
}

// WithURL sets the optional URL for the note.
func (b *NoteBuilder) WithURL(url string) *NoteBuilder {
	b.note.Url = url
	return b
}

// WithBody sets the markdown body for the note.
func (b *NoteBuilder) WithBody(body string) *NoteBuilder {
	b.note.Body = body
	return b
}

// WithDescription appends legacy link description text to the note body.
func (b *NoteBuilder) WithDescription(desc string) *NoteBuilder {
	if desc == "" {
		return b
	}
	if b.note.Body == "" {
		b.note.Body = desc
		return b
	}
	b.note.Body = fmt.Sprintf("%s\n\n%s", b.note.Body, desc)
	return b
}

// WithTitle sets the title for the note.
func (b *NoteBuilder) WithTitle(name string) *NoteBuilder {
	b.note.Title = name
	return b
}

// WithDisplayName sets the title for legacy link-shaped callers.
func (b *NoteBuilder) WithDisplayName(name string) *NoteBuilder {
	return b.WithTitle(name)
}

// WithTags sets the tags for the note.
func (b *NoteBuilder) WithTags(tags []string) *NoteBuilder {
	b.note.Tags = tags
	return b
}

// WithId sets the id for the note.
func (b *NoteBuilder) WithId(id string) *NoteBuilder {
	b.note.Id = id
	return b
}

// WithData sets the data for the note.
func (b *NoteBuilder) WithData(data map[string]any) *NoteBuilder {

	// If the data is not empty we will add it to the proto.Note.
	if len(data) > 0 {
		sp, err := structpb.NewStruct(data)
		if err != nil {
			log.Fatalf("error creating structpb: %v", err)
		}
		b.note.Data = sp
	}

	return b
}

// WithAnnotations sets the metadata for the note.
func (b *NoteBuilder) WithAnnotations(annotations map[string]string) *NoteBuilder {
	b.note.Annotations = annotations
	return b
}

// Build creates a new Note from the builder.
func (b *NoteBuilder) Build() (*Note, error) {
	if b.note.Title == "" && b.note.Url != "" {
		b.note.SetTitle()
	}

	if b.note.Id == "" && b.note.Url != "" {
		b.note.Id = b.note.Url
	}

	if b.note.Body == "" && b.note.Url != "" {
		b.note.Body = b.note.Url
	}

	if b.note.Id == "" {
		return nil, fmt.Errorf("id is required - %v", b.note)
	}

	return b.note, nil
}

// SetTitle sets the title for the note.
func (n *Note) SetTitle() {

	if n.Title != "" {
		return
	}

	u, err := url.Parse(n.Url)
	if err != nil {
		log.Fatalf("error parsing url: %v", err)
	}

	host := strings.TrimPrefix(u.Host, "www.")
	n.Title = fmt.Sprintf("%s%s", host, u.Path)
}

// GetKey returns the key for the note to be used in cache/backend.
func (n *Note) GetKey() string {
	return n.Id
}
