package deletecmd

import (
	"fmt"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	links  []string
	tags   []string
	groups []string
)

// rootCmd represents the base command when called without any subcommands
var DeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "delete from cartographer server",
	Long:  `delete from cartographer server. Can be supplied with one to many links, tags, linkGroups`,
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

		r, err := c.Client.Delete(c.Ctx, proto.NewCartographerDeleteRequest(links, tags, groups))
		if err != nil {
			log.Fatalf("Failed to Delete links %s", err)
		}

		out, err := yaml.Marshal(r)
		if err != nil {
			log.Fatalf("Unable to marshal response %s", err)
		}

		fmt.Printf("%s", out)
	},
}

func init() {
	DeleteCmd.Flags().StringSliceVarP(&links, "links", "l", nil, "links to delete from cartographer server e.g -l=https://github.com,https://gitlab.com")
	DeleteCmd.Flags().StringSliceVarP(&tags, "tag", "t", nil, `Tags to delete -t=git,k8s`)
	DeleteCmd.Flags().StringSliceVarP(&groups, "group", "g", nil, `Groups to Delete -t=git,k8s`)
}
