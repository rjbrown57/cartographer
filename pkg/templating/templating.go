package templating

import (
	"bytes"
	"text/template"
)

func TemplateString(templateString string, data any) (string, error) {

	// we need an io.Writer to capture the template output
	buf := new(bytes.Buffer)

	tmpl, err := template.New("stringFormatter").Parse(templateString)
	if err != nil {
		return "", err
	}

	err = tmpl.Execute(buf, data)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}
