package templating

import (
	"bytes"
	"log"
	"text/template"

	"github.com/go-sprout/sprout"
	"github.com/go-sprout/sprout/group/all"
)

func TemplateString(templateString string, data any) (string, error) {

	handler := sprout.New()
	err := handler.AddGroups(all.RegistryGroup())
	if err != nil {
		log.Fatal(err)
	}

	// we need an io.Writer to capture the template output
	buf := new(bytes.Buffer)

	// https://github.com/Masterminds/sprout use sprout functions for extra templating functions
	tmpl, err := template.New("stringFormatter").Funcs(handler.Build()).Parse(templateString)
	if err != nil {
		return "", err
	}

	err = tmpl.Execute(buf, data)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}
