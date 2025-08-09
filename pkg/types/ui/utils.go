package ui

import (
	"strings"

	"github.com/gin-gonic/gin"
	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
)

func NewTemplatingHeaders(c *gin.Context, pr *proto.CartographerResponse) *gin.H {

	sitename, _ := c.Get("sitename")

	m := gin.H{}

	// Add Strings to Map
	for k, v := range map[string]any{
		"Groups":   pr.Groups,
		"Links":    pr.Links,
		"Tags":     pr.Tags,
		"SiteName": sitename,
	} {
		m[k] = v
	}

	if c.Request.RequestURI != "/" {
		groups, _ := c.Get("Groups")
		m["Groups"] = groups
	}

	return &m
}

func NewErrorHeaders(c *gin.Context, code int, err error) *gin.H {
	return &gin.H{
		"Code":    code,
		"Message": err.Error(),
	}
}

func SplitQueryArray(queryParams []string) []string {

	query := make([]string, 0)
	for _, q := range queryParams {
		if strings.Contains(q, ",") {
			for t := range strings.SplitSeq(q, ",") {
				query = append(query, t)
			}
		} else {
			query = append(query, q)
		}
	}
	return query
}
