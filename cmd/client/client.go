package client

import (
	"github.com/rjbrown57/cartographer/pkg/log"

	andcmd "github.com/rjbrown57/cartographer/cmd/client/add"
	deletecmd "github.com/rjbrown57/cartographer/cmd/client/delete"
	getcmd "github.com/rjbrown57/cartographer/cmd/client/get"
	pingcmd "github.com/rjbrown57/cartographer/cmd/client/ping"

	"github.com/spf13/cobra"
)

var (
	port int
	addr string
)

// rootCmd represents the base command when called without any subcommands
var ClientCmd = &cobra.Command{
	Use:   "client",
	Short: "client operations to use with cartographer server",
	Long:  `Perform client operations against a running cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {
		err := cmd.Help()
		if err != nil {
			log.Fatalf("%s", err)
		}
	},
}

func init() {
	ClientCmd.AddCommand(pingcmd.PingCmd, getcmd.GetCmd, andcmd.AddCmd, deletecmd.DeleteCmd)
	ClientCmd.PersistentFlags().IntVarP(&port, "port", "p", 8080, "port to communicate with cartographer server on")
	ClientCmd.PersistentFlags().StringVarP(&addr, "address", "a", "", "address of cartographer server")
}
