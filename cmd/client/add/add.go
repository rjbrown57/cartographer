package addcmd

import (
	"fmt"

	"github.com/rjbrown57/cartographer/pkg/log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	links []string
	tags  []string
	group []string
	file  string
)

// rootCmd represents the base command when called without any subcommands
var AddCmd = &cobra.Command{
	Use:   "add",
	Short: "add to cartographer server",
	Long:  `add to cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {

		validate()

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

		if file != "" {
			HandleConfig(c, file)
			return
		}

		r := proto.NewCartographerAddRequest(links, tags, group)

		response, err := c.Client.Add(c.Ctx, r)
		if err != nil {
			log.Fatalf("Failed to Add links %s", err)
		}

		OutputResponse(response.Response)
	},
}

func validate() {
	// If file is unset we expect at least one of the other options to be set
	if file == "" {
		// We only allow a single group to be added
		// The nil default stops bogus groups with "" being added
		if len(group) > 1 {
			log.Fatalf("Only one group can be added at a time")
		}

		if len(group) == 0 && len(links) == 0 {
			log.Fatalf("Either a group or link(s) must be supplied")
		}
	}
}

func init() {
	AddCmd.Flags().StringSliceVarP(&links, "links", "l", nil, "link to add to cartographer serer e.g -l=https://github.com,https://gitlab.com")
	AddCmd.Flags().StringSliceVarP(&tags, "tag", "t", nil, `Tags to add to the supplied links -t=git,k8s`)
	AddCmd.Flags().StringSliceVarP(&group, "group", "g", nil, "Group To add")
	AddCmd.Flags().StringVarP(&file, "file", "f", "", "file config to add")

}

// TODO refactor to do one request not 3 :)
func HandleConfig(c *client.CartographerClient, file string) {

	config := config.NewCartographerConfig(file)

	resp, err := config.AddToBackend(c)
	if err != nil {
		log.Fatalf("Unable to add config to backend %s", err)
	}

	OutputResponse(resp)
}

func OutputResponse(r interface{}) {
	out, err := yaml.Marshal(r)
	if err != nil {
		log.Fatalf("Unable to marshal response %s", err)
	}

	fmt.Printf("%s", out)
}
