package web

import (
	"embed"
	"io/fs"
)

//go:embed html/*
var HtmlFS embed.FS

//go:embed js/*
var JsFS embed.FS

func GetJSFS() fs.FS {
	f, err := fs.Sub(JsFS, "js")
	if err != nil {
		panic(err)
	}
	return f
}

//go:embed assets/*
var AssetsFS embed.FS

func GetAssetsFS() fs.FS {
	f, err := fs.Sub(AssetsFS, "assets")
	if err != nil {
		panic(err)
	}
	return f
}
