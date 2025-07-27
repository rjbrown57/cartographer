package generatecmd

import (
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/utils"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	num int
)

// rootCmd represents the base command when called without any subcommands
var GenerateCmd = &cobra.Command{
	Use:   "generate",
	Short: "generate a fake ingestion config to test with cartographer server",
	Long:  `generate urls to test with cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {

		// Configure logging to info level for all generate commands
		// This is to avoid the log messages from the generate command from being printed to the console
		log.ConfigureLog(false, 0)

		genLinks := make([]*proto.Link, 0)
		for i := 0; i < num; i++ {
			genLinks = append(genLinks, proto.NewLinkBuilder().
				WithURL(utils.GenerateFakeURL()).
				WithTags([]string{"default"}).
				WithData(utils.GenerateFakeData()).
				Build())
		}

		c := config.CartographerConfig{
			Links:  genLinks,
			Groups: []*proto.Group{{Name: "default", Tags: []string{"default"}}},
		}
		o, err := yaml.Marshal(c)
		if err != nil {
			log.Fatalf("Unable to marshal generated links %s", err)
		}

		fmt.Printf("%s", o)
	},
}

func init() {
	GenerateCmd.Flags().IntVarP(&num, "num", "n", 1, "number of links to generate")
	err := GenerateCmd.MarkFlagRequired("num")
	if err != nil {
		log.Fatalf("%s", err)
	}
}
