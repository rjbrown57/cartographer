package addcmd

import (
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	links []string
	tags  []string
	group []string
)

// rootCmd represents the base command when called without any subcommands
var AddCmd = &cobra.Command{
	Use:   "add",
	Short: "add to cartographer server",
	Long:  `add to cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {

		addr, err := cmd.Flags().GetString("address")
		if err != nil {
			log.Fatalf("Unable to get address in cmd")
		}

		port, err := cmd.Flags().GetInt("port")
		if err != nil {
			log.Fatalf("Unable to get port in cmd")
		}

		o := client.CartographerClientOptions{
			Address: addr,
			Port:    port,
		}
		c := client.NewCartographerClient(&o)
		if err != nil {
			log.Fatalf("%s", err)
		}

		r := proto.NewProtoCartographerRequest(links, tags, group, proto.RequestType_DATA)

		response, err := c.Client.Add(*c.Ctx, r)
		if err != nil {
			log.Fatalf("Failed to Add links %s", err)
		}

		out, err := yaml.Marshal(response)
		if err != nil {
			log.Fatalf("Unable to marshal response %s", err)
		}

		fmt.Printf("%s", out)
	},
}

func init() {
	AddCmd.Flags().StringSliceVarP(&links, "links", "l", nil, "link to add to cartographer serer e.g -l=https://github.com,https://gitlab.com")
	AddCmd.Flags().StringSliceVarP(&tags, "tag", "t", nil, `Tags to add to the supplied links -t=git,k8s`)
	AddCmd.Flags().StringSliceVarP(&group, "group", "g", nil, "Group To add")

	// We only allow a single group to be added
	// The nil default stops bogus groups with "" being added
	if len(group) > 1 {
		log.Fatal("Only one group can be added at a time")
	}
}
