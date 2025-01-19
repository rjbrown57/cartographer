package inmemory

import (
	"log"
	"sort"
	"sync"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/types/data"
	"github.com/rjbrown57/cartographer/pkg/types/notifier"
)

type InMemoryBackend struct {
	Groups   GroupMap
	Tags     TagMap
	Links    LinkMap
	Notifier *notifier.Notifier

	backupConfig *config.BackupConfig
	mu           *sync.Mutex
}

func NewInMemoryBackend(c *config.BackupConfig) *InMemoryBackend {
	i := &InMemoryBackend{
		Groups:       make(GroupMap),
		Tags:         make(TagMap),
		Links:        make(LinkMap),
		mu:           &sync.Mutex{},
		backupConfig: c,
		Notifier:     notifier.NewNotifier(),
	}

	// TODO validate backup path / content
	if c.Enabled && c.BackupPath != "" {
		log.Printf("Backup enabled, using %s", c.BackupPath)
	}

	return i
}

type GroupMap map[string]*data.Group

func (g GroupMap) GetGroup(group string) *data.Group {
	if g, exists := g[group]; exists {
		return g
	}

	return nil
}

func (g GroupMap) GetGroupNames() []string {
	r := make([]string, 0)

	for _, group := range g {
		r = append(r, group.Name)
	}

	sort.Strings(r)

	return r
}

type TagMap map[string]*data.Tag

func (t TagMap) GetTagsNames() []string {
	r := make([]string, 0)

	for _, tag := range t {
		r = append(r, tag.Name)
	}

	sort.Strings(r)

	return r
}

// GetProtoLinks will return a slice of proto.Links for communcation with the client
func (t TagMap) GetProtoLinks() []*proto.Link {
	r := make([]*proto.Link, 0)

	for _, tag := range t {
		for _, link := range tag.Links {
			r = append(r, link.GetProtoLink())
		}
	}

	return r
}

// NewTag will create a tag if it does not exist, or return a pointer to the tag
func (t TagMap) NewTag(tagName string) *data.Tag {
	if tag, exists := t[tagName]; exists {
		return tag
	}

	t[tagName] = data.NewTag(tagName)

	return t[tagName]
}

type LinkMap map[string]*data.Link

func (l LinkMap) GetLinkStrings() []string {
	r := make([]string, 0)

	for _, link := range l {
		r = append(r, link.Link.String())
	}

	sort.Strings(r)

	return r
}

// GetProtoLinks will return a slice of proto.Links for communcation with the client
func (l LinkMap) GetProtoLinks() []*proto.Link {
	r := make([]*proto.Link, 0)

	keys := l.GetLinkStrings()
	sort.Strings(keys)

	for _, link := range keys {
		r = append(r, l[link].GetProtoLink())
	}

	return r
}

func (l LinkMap) NewLink(rawUrl string) *data.Link {

	var err error

	if link, exists := l[rawUrl]; exists {
		return link
	}

	l[rawUrl], err = data.NewLink(rawUrl)
	if err != nil {
		log.Printf("Issue adding link %s %s", rawUrl, err)
		return nil
	}

	return l[rawUrl]
}
