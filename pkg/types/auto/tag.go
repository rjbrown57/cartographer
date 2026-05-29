package auto

import (
	"regexp"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

type AutoTag struct {
	Regex       *regexp.Regexp `yaml:"-"`
	RegexString string         `yaml:"regex,omitempty"`
	Tags        []string       `yaml:"tags,omitempty"`
}

// ProcessAutoTags will process the auto tags for a note.
func ProcessAutoTags(note *proto.Note, at []*AutoTag) {

	autoTags := make(map[string]struct{})

	// Add initial tags so we can dedup
	for _, tag := range note.Tags {
		autoTags[tag] = struct{}{}
	}

	for _, autoTag := range at {
		// if the tag matches, add to the tagMap
		if autoTag.Regex.MatchString(note.Url) || autoTag.Regex.MatchString(note.Body) || autoTag.Regex.MatchString(note.Title) {
			for _, tag := range autoTag.Tags {
				autoTags[tag] = struct{}{}
			}
		}
	}

	note.Tags = note.Tags[:0] // Clear the existing tags to avoid duplication

	for tag := range autoTags {
		note.Tags = append(note.Tags, tag)
	}

}

// Configure will compile the regex for the auto tag
func (a *AutoTag) Configure() {
	// If the regex is already compiled, return
	if a.Regex != nil {
		return
	}
	log.Infof("Configuring auto tag `%s` - %s", a.RegexString, a.Tags)
	a.Regex = regexp.MustCompile(a.RegexString)
}
