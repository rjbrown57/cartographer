package test

import (
	"log"

	generatecmd "github.com/rjbrown57/cartographer/cmd/test/generate"

	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var TestCmd = &cobra.Command{
	Use:   "test",
	Short: "test operations to use with cartographer server",
	Long:  `Helpers for test operattions with cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {
		err := cmd.Help()
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	TestCmd.AddCommand(generatecmd.GenerateCmd)
	TestCmd.Hidden = true
}
