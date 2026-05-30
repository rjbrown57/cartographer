package mcpcmd

import (
	"os"

	"github.com/rjbrown57/cartographer/pkg/log"
	"github.com/rjbrown57/cartographer/pkg/types/client"
	"github.com/rjbrown57/cartographer/pkg/types/mcp"
	"github.com/spf13/cobra"
)

var (
	port int
	addr string
)

// McpCmd starts an MCP stdio server backed by a live Cartographer gRPC server.
var McpCmd = &cobra.Command{
	Use:   "mcp",
	Short: "Start a Cartographer MCP server over stdio",
	Long:  `Start a Cartographer MCP server over stdio for tools like Codex to query a live Cartographer instance.`,
	Run: func(cmd *cobra.Command, args []string) {
		o := client.CartographerClientOptions{
			Address: addr,
			Port:    port,
		}
		c := client.NewCartographerClient(&o)
		defer c.ClientConn.Close()

		server := mcp.NewServer(c.Ctx, c.Client, os.Stdin, os.Stdout)
		if err := server.Serve(); err != nil {
			log.Fatalf("MCP server failed: %s", err)
		}
	},
}

// init registers command flags for the MCP stdio server.
func init() {
	McpCmd.Flags().IntVarP(&port, "port", "p", 8080, "port to communicate with cartographer server on")
	McpCmd.Flags().StringVarP(&addr, "address", "a", "", "address of cartographer server")
}
