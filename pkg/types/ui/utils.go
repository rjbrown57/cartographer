package ui

import (
	"github.com/gin-gonic/gin"
	"github.com/rjbrown57/cartographer/pkg/proto"
)

func NewTemplatingHeaders(c *gin.Context, pr *proto.CartographerResponse) *gin.H {

	sitename, _ := c.Get("sitename")

	return &gin.H{
		"Groups":   pr.Groups,
		"Links":    pr.Links,
		"Tags":     pr.Tags,
		"SiteName": sitename,
	}

}

func NewErrorHeaders(c *gin.Context, code int, err error) *gin.H {
	return &gin.H{
		"Code":    code,
		"Message": err.Error(),
	}
}
