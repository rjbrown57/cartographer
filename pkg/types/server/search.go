package server

import (
	"github.com/blevesearch/bleve"
	"github.com/blevesearch/bleve/search/query"
	"github.com/rjbrown57/cartographer/pkg/log"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

// SearchLimit represents the scope of the search
type SearchLimit string

const (
	SearchLimitAll         SearchLimit = "*"
	SearchLimitDescription SearchLimit = "description"
	SearchLimitURL         SearchLimit = "url"
	SearchLimitTags        SearchLimit = "tags"
	// initial testing found issues with data field, so we are using all for now
	SearchLimitData SearchLimit = "*"
)

func (l SearchLimit) String() string {
	return string(l)
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

func (c *CartographerServer) GetTagMap(in *proto.CartographerGetRequest) (map[string]struct{}, error) {
	tagFilters := make(map[string]struct{})

	// add the tags to the tag map
	for _, tag := range in.Request.Tags {
		tagFilters[tag.Name] = struct{}{}
	}

	// expand the groups into tags
	for _, group := range in.Request.Groups {
		if g, ok := c.groupCache[group.Name]; ok {
			for _, tag := range g.Tags {
				tagFilters[tag] = struct{}{}
			}
		} else {
			return nil, utils.GroupNotFoundError
		}
	}

	log.Debugf("Tag Filters: %v", tagFilters)

	return tagFilters, nil
}

func (c *CartographerServer) Search(in *proto.CartographerGetRequest, options *SearchOptions) ([]*proto.Link, error) {

	terms := in.Request.GetTerms()

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

	links := make([]*proto.Link, 0)

	log.Tracef("Search Results(%v): %+v", results.Took, results.Total)

	// add the hits to the links
	for _, hit := range results.Hits {
		if link, exists := c.cache[hit.ID]; exists {
			links = append(links, link)
		}
	}

	return links, nil
}
