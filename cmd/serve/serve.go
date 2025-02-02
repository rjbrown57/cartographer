package servecmd

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"runtime/pprof"

	"github.com/rjbrown57/cartographer/pkg/types/server"
	"github.com/spf13/cobra"
)

var (
	config  string
	profile bool
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
		if profile {
			go Pprof()
		}
		c := server.NewCartographerServer(&o)
		c.Serve()
	},
}

// Make optional
func Pprof() {
	// Create a CPU profile file
	f, err := os.Create("profile.prof")
	if err != nil {
		panic(err)
	}
	defer f.Close()

	// Start CPU profiling
	if err := pprof.StartCPUProfile(f); err != nil {
		panic(err)
	}

	// Create a memory profile file
	memProfileFile, err := os.Create("mem.prof")
	if err != nil {
		panic(err)
	}
	defer memProfileFile.Close()

	log.Printf("Started CPU profile at %s\n", "profile.prof")

	// Listen for OS signals to gracefully shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, os.Kill)

	<-sigChan

	// force GC to get up-to-date statistics
	runtime.GC()

	log.Println("Received shutdown signal, stopping CPU profile")
	pprof.StopCPUProfile()

	// Write memory profile to file
	// view with go tool pprof -http 0.0.0.0:8084 mem.prof
	if err := pprof.WriteHeapProfile(memProfileFile); err != nil {
		panic(err)
	}

	fmt.Println("Memory profile written to mem.prof")

	os.Exit(0)
}

func init() {
	ServeCmd.Flags().StringVarP(&config, "config", "c", "", "config file for cartographer")
	ServeCmd.Flags().BoolVarP(&profile, "profile", "p", false, "enable pprof profiling")
	err := ServeCmd.MarkFlagRequired("config")
	if err != nil {
		log.Fatal(err)
	}

}
