package pingcmd

import (
	"log"
	"os"

	proto "github.com/rjbrown57/cartographer/pkg/proto/cartographer/v1"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var PingCmd = &cobra.Command{
	Use:   "ping",
	Short: "ping cartographer server",
	Long:  `ping cartographer server`,
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
		h, err := os.Hostname()
		if err != nil {
			log.Fatalf("%s", err)
		}
		pr, err := c.Client.Ping(c.Ctx, &proto.PingRequest{Name: h})
		if err != nil {
			log.Fatalf("Error sending ping %s", err)
		}
		log.Printf("%s", pr.GetMessage())
	},
}
