package getcmd

import (
	"context"
	"fmt"
	"io"
	"log"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	groups []string
	tags   []string
	watch  bool
)

// rootCmd represents the base command when called without any subcommands
var GetCmd = &cobra.Command{
	Use:   "get",
	Short: "get from cartographer server",
	Long:  `get from cartographer server`,
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

		// Need to get smart about this
		pr := proto.NewProtoCartographerRequest(nil, tags, groups, proto.RequestType_DATA)

		// https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc
		if watch {
			streamGet(c, pr)
			return
		}

		response, err := c.Client.Get(c.Ctx, pr)
		if err != nil {
			log.Fatalf("Failed to get links %s", err)
		}

		log.Println("received:")

		out, err := yaml.Marshal(response)
		if err != nil {
			log.Fatalf("Unable to marshal response %s", err)
		}

		fmt.Printf("%s", out)
	},
}

func init() {
	GetCmd.Flags().BoolVarP(&watch, "watch", "w", false, "Open a watch on the server based on supplied flags")
	GetCmd.Flags().StringSliceVarP(&groups, "group", "g", nil, "link group to query cartographer for e.g -g=example,oci --g=example")
	GetCmd.Flags().StringSliceVarP(&tags, "tag", "t", nil, `Tags to query for e.g --t="k8s,oci" --ss="default"`)
}
