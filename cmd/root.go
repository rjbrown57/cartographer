package cmd

import (
	"os"

	"github.com/rjbrown57/cartographer/pkg/log"

	clientcmd "github.com/rjbrown57/cartographer/cmd/client"
	servecmd "github.com/rjbrown57/cartographer/cmd/serve"
	testcmd "github.com/rjbrown57/cartographer/cmd/test"
	"github.com/spf13/cobra"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
	jsonLog bool
	debug   int
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "cartographer",
	Short: "cartographer",
	Long:  `cartographer`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		log.ConfigureLog(jsonLog, debug)
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		err := cmd.Help()
		if err != nil {
			log.Fatalf("%s", err)
		}
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}

}

func init() {
	// Set the logging options
	rootCmd.PersistentFlags().CountVarP(&debug, "debug", "d", "enable debug logging. Set multiple times to increase log level")
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json", "j", false, "enable json style logging")
	rootCmd.AddCommand(servecmd.ServeCmd, clientcmd.ClientCmd, testcmd.TestCmd, versionCmd)
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number of cartographer",
	Long:  `All software has versions. This is cartographer's`,
	Run: func(cmd *cobra.Command, args []string) {
		log.Infof("Cartographer version %s", version)
	},
}
