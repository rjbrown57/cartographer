package cmd

import (
	"log"
	"os"

	clientcmd "github.com/rjbrown57/cartographer/cmd/client"
	servecmd "github.com/rjbrown57/cartographer/cmd/serve"
	testcmd "github.com/rjbrown57/cartographer/cmd/test"
	"github.com/spf13/cobra"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "cartographer",
	Short: "cartographer",
	Long:  `cartographer`,
	Run: func(cmd *cobra.Command, args []string) {
		err := cmd.Help()
		if err != nil {
			log.Fatal(err)
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
	rootCmd.AddCommand(servecmd.ServeCmd, clientcmd.ClientCmd, testcmd.TestCmd, versionCmd)
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number of cartographer",
	Long:  `All software has versions. This is cartographer's`,
	Run: func(cmd *cobra.Command, args []string) {
		log.Printf("Cartographer version %s", version)
	},
}
