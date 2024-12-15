package ui

import (
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
