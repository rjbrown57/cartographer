# AGENTS.md

# Project information
- Cartographer is a single binary webapp with a Go backend, and a Gin-served/TypeScript-based web UI. Cartographer is used to aggregate information either by configuration file or by injection via gRPC.
- Cartographer UI is meant to serve large amounts of data, but with a human focus, and make it instantly filterable for a user. The goal is to open the site, and find the information you need in a minimum amount of time.

# task
- this repo uses https://github.com/go-task/task for common workflows. See the descriptions of the workflows in Taskfile.yml. task is a make alternative written in golang.
- Go binary can be rebuilt with task snapshot
- task ts for TypeScript build
- task serve to run cartographer with sample config
- task build will run all build commands.

# Project structure
- `cmd/`, `main.go`: Go entrypoint and wiring.
- `pkg/`: Go packages (types, handlers, etc).
- `web/html/`: Served HTML shell (embedded). 
- `web/src/`: TypeScript source for UI; `web/js/` holds the built output embedded by Go. See web/embed.go for embedding code. Rebuild with task ts.
- `web/assets/`: Static assets (favicon, etc).
- `example/`: Sample configs and data. Can be read for common ports and configuration style.
- `charts/`: Helm chart.
- `Taskfile.yml`: Common tasks (buf/ts/build/serve).
- `proto`: protobuf definitions buf config.

# development guidelines
- comment extensively but not pedantically, you do not need to explain anything that would be considered 'basic'.
- always comment the line before a function with the name and a brief description of it's function.
- generate sample data with task generate. This requires a running cartographer.
- use gofmt for golang formatting

# Pull Requests
- always run `task test-cartographer` before PRs. This must pass.
- use conventional git commits. https://www.conventionalcommits.org/en/v1.0.0/.
