# Working on Cartographer

Cartographer is a single-binary Go application that collects notes from configuration files and gRPC clients. Its React UI helps readers find information quickly across large collections. Preserve that workflow when changing search, namespace navigation or how much information a card displays.

## Where a request goes

- `main.go` and `cmd/` expose the CLI. Start in `cmd/serve/` for service startup, `cmd/client/` for CLI note operations and `cmd/mcp/` for the MCP command.
- `pkg/types/ui/gin.go` registers the browser routes, static assets, HTTP API and admin middleware. Follow a note request into `pkg/types/ui/v1.go`. Session handling, admin operations and archive endpoints have their own files in the same package. Enforce permissions on the server even when the UI hides an action.
- `pkg/types/server/` implements the gRPC service and owns note operations, search, caching and archive handling. For a change that affects every writer, follow the operation here as well as through the HTTP handler. For persistence, see the interfaces in `pkg/types/backend/` and the BoltDB implementation in `pkg/backends/boltdb/`.
- `proto/cartographer/v1/` holds the protobuf definitions. `task buf` regenerates the Go bindings in `pkg/proto/`. HTTP documentation is generated separately by `task swagger` into `pkg/types/ui/docs/`.
- `example/` contains sample configuration and data. `explorer/basic/` and `explorer/k8s/` are explorer programs. The deployment chart is in `charts/cartographer/`.

## React UI

Gin serves three HTML shells from `web/html/`. Each loads its own Vite entry point. Start with the route that owns the interaction.

| Route | Entry point | Responsibilities |
| --- | --- | --- |
| `/` | `web/src/react/desktop.tsx` | Namespace navigation, search and tag filters, card grid, expanded details and note actions. `AdminPanel.tsx` owns the Tools drawer, preferences, sessions and admin controls. |
| `/mobile` | `web/src/react/mobile.tsx` | Phone feed, filter sheet, sorting and links back to the filtered feed. `web/src/mobile/model.ts` contains the feed’s presentation and search helpers. |
| `/note` | `web/src/react/note.tsx` | Standalone reader and full-page create/edit workspace, Markdown editing with CodeMirror, templates, metadata, save and dirty-state handling. `web/src/noteEditor.ts` contains editor helpers used independently of React. |

**Shared behavior.** Use `web/src/react/api.ts` for same-origin requests and response envelopes, and `navigation.ts` in the same directory for note URLs and namespace selection. Shared note types and Markdown rendering live in `web/src/shared/`. Color and sort preferences live in `web/src/preferences/`, and the browser note cache lives in `web/src/components/cache.ts`. When changing a filter or link, check desktop and mobile entry points as well as opening the resulting URL directly.

**Presentation.** `web/src/react/JoyShell.tsx` supplies the shared Joy UI theme. Page layout and shared CSS live in `web/css/joy.css`, with canvas-specific rules in `web/css/diagram.css`. Keep desktop card and mobile feed layouts independent where they serve different interactions.

**Diagram notes.** The editable Excalidraw scene is stored in the existing note data field. `web/src/react/diagram.ts` recognizes and serializes that shape. `DiagramIndicator.tsx` identifies diagrams in browsing views, while `DiagramCanvas.tsx` owns the interactive canvas and library integration. A scene format change also touches validation in `pkg/types/ui/v1.go` and `pkg/types/server/diagram.go`, including the archive import path. For library or navigation changes, check the return trip with both a saved diagram and an unsaved draft.

## Build and verification

Use the repository’s Go Task workflows from the root. See `Taskfile.yml` for their definitions.

- **Build frontend assets** with `task ts`. Edit TypeScript and TSX under `web/src/`. The compiler emits shared JavaScript into `web/js/`, and `web/vite.config.mts` builds the three React entries and their assets into `web/js/react/`. Include the resulting tracked build changes with the source.
- **Run the updated UI locally** with `go build -o cartographer .` after building the frontend, then `task serve`. The serve task runs the existing binary with the sample configuration. Rebuilding matters because `web/embed.go` embeds the HTML, JavaScript, CSS and static assets at Go build time. Use `task generate` against a running instance to populate sample notes.
- **Test the frontend** with `npm test` from `web/`. It builds the UI and runs the helper suites in `web/test/`. Gin route coverage lives in `pkg/types/ui/pages_test.go`, and embedded asset checks live in `web/embed_test.go`.
- **Build a release snapshot** with `task snapshot`. For the full protobuf, frontend, Swagger and snapshot sequence, run `task build`.

## Development and pull requests

Use gofmt for Go changes. Place a comment immediately before each function with its name and a brief description of its purpose. Explain domain decisions and non-obvious behavior in the surrounding code.

Follow the repository’s conventional commit style. Run `task test-cartographer` before opening a pull request. It must pass.
