package servecmd

import (
	"log"

	"github.com/rjbrown57/cartographer/pkg/types/server"
	"github.com/spf13/cobra"
)

var (
	config string
)

// rootCmd represents the base command when called without any subcommands
var ServeCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start cartographer server",
	Long:  `Start cartographer server`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	Run: func(cmd *cobra.Command, args []string) {
		o := server.CartographerServerOptions{
			ConfigFile: config,
		}
		c := server.NewCartographerServer(&o)
		c.Serve()
	},
}

func init() {
	ServeCmd.Flags().StringVarP(&config, "config", "c", "", "config file for cartographer")
	err := ServeCmd.MarkFlagRequired("config")
	if err != nil {
		log.Fatal(err)
	}

}
