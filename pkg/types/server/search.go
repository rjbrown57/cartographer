package server

import (
	"strings"

	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/search/query"
	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

// SearchLimit represents the scope of the search
type SearchLimit string

const (
	SearchLimitAll         SearchLimit = "*"
	SearchLimitDescription SearchLimit = "body"
	SearchLimitBody        SearchLimit = "body"
	SearchLimitURL         SearchLimit = "url"
	SearchLimitTags        SearchLimit = "tags"
	// initial testing found issues with data field, so we are using all for now
	SearchLimitData     SearchLimit = "*"
	bleveDocIDSeparator string      = "/"
)

func (l SearchLimit) String() string {
	return string(l)
}

// makeBleveDocID creates a namespace-qualified bleve document ID for a note key.
func makeBleveDocID(namespace, key string) string {
	return namespace + bleveDocIDSeparator + key
}

// parseBleveDocID splits a bleve document ID into namespace and note key components.
func parseBleveDocID(id string) (string, string, bool) {
	namespace, key, ok := strings.Cut(id, bleveDocIDSeparator)
	if !ok || namespace == "" || key == "" {
		return "", "", false
	}
	return namespace, key, true
}

// SearchOptions contains configuration for search operations
type SearchOptions struct {
	// SearchLimit are used to scope the search to a specific field
	Limit SearchLimit `json:"limit" yaml:"limit"`
	// Size is the number of results to return
	Size int `json:"size" yaml:"size"`
}

func (o *SearchOptions) GetSearchRequest(terms []string) *bleve.SearchRequest {

	queries := make([]query.Query, 0)

	// create a query for all terms
	for _, term := range terms {
		q := bleve.NewMatchQuery(term)
		if o.Limit != SearchLimitAll {
			q.SetField(o.Limit.String())
		}
		queries = append(queries, q)
	}

	request := bleve.NewSearchRequest(bleve.NewConjunctionQuery(queries...))

	// if size is not set, use a default of 500
	if o.Size == 0 {
		request.Size = 500
	} else {
		request.Size = o.Size
	}

	return request
}

// getNamespaceTagMap builds the effective tag filter set for a namespaced request.
func (c *CartographerServer) GetTagMap(in *proto.CartographerGetRequest) (map[string]struct{}, error) {
	tagFilters := make(map[string]struct{})

	// add the tags to the tag map
	for _, tag := range in.Request.Tags {
		tagFilters[tag.Name] = struct{}{}
	}

	log.Debugf("Tag Filters: %v", tagFilters)

	return tagFilters, nil
}

// Search executes a bleve query and resolves hits against namespace-scoped in-memory note cache.
func (c *CartographerServer) Search(in *proto.CartographerGetRequest, options *SearchOptions) ([]*proto.Note, error) {
	ns, err := proto.GetNamespace(in.Request.GetNamespace())
	if err != nil {
		return nil, err
	}

	terms := append([]string{}, in.Request.GetTerms()...)

	tagMap, err := c.GetTagMap(in)
	if err != nil {
		return nil, err
	}

	// add the tags to the terms
	for tag := range tagMap {
		terms = append(terms, tag)
	}

	log.Debugf("Searching for Terms: %v", terms)

	// execute the search
	results, err := c.bleve.Search(options.GetSearchRequest(terms))
	if err != nil {
		return nil, err
	}

	notes := make([]*proto.Note, 0)

	log.Tracef("Search Results(%v): %+v", results.Took, results.Total)

	// Resolve hits to notes using the namespace-scoped cache only.
	c.mu.RLock()
	cn, ok := c.nsCache[ns]
	c.mu.RUnlock()
	if !ok {
		return notes, nil
	}

	cn.mu.RLock()
	for _, hit := range results.Hits {
		hitNamespace, noteKey, ok := parseBleveDocID(hit.ID)
		if !ok {
			// Backward compatibility for existing index entries that were stored
			// without a namespace-qualified document ID.
			if note, exists := cn.NoteCache[hit.ID]; exists {
				notes = append(notes, note)
			}
			continue
		}

		if hitNamespace != ns {
			continue
		}

		if note, exists := cn.NoteCache[noteKey]; exists {
			notes = append(notes, note)
		}
	}
	cn.mu.RUnlock()

	return notes, nil
}
