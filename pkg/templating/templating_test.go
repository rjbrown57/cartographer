package templating

import (
	"os"
	"testing"

	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/utils"
)

var templateText string = `{{.ServerConfig.Address}}`
var renderText string = `0.0.0.0`

func TestTemplateString(t *testing.T) {

	var tests = []struct {
		templateString string
		expectedString string
	}{
		{templateText, renderText},
	}

	configFile, err := utils.WriteTestConfig()
	if err != nil {
		t.Fatalf("Unable to write test config %s", err)
	}

	t.Cleanup(func() {
		configFile.Close()
		os.Remove(configFile.Name())
	})

	c := config.NewCartographerConfig(configFile.Name())

	for _, test := range tests {
		if retval, _ := TemplateString(test.templateString, c); retval != test.expectedString {
			t.Fatalf("Expected:::\n %s\nGot:::\n %s\n", test.expectedString, retval)
		}
	}
}
