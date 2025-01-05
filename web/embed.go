package web

import (
	"embed"
)

//go:embed html/*
var HtmlFS embed.FS

//go:embed js/*
var JsFS embed.FS
