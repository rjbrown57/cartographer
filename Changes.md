# Changes Since v1.0.1

This branch moves Cartographer from a link-oriented viewer toward a note-oriented knowledge surface for both human use and programmatic clients.

## Note Model

- Replaces the legacy link-first UI model with canonical notes.
- Treats URLs as optional note metadata instead of a separate card type.
- Adds markdown note bodies throughout ingest, API, UI, and generated data paths.
- Adds structured note data support through the composer and rendering path.
- Adds note metadata fields:
  - `created_at`
  - `updated_at`
  - `source`
  - `author`
  - `version`
- Preserves `created_at` on edits, updates `updated_at`, and increments note versions on re-submission.
- Keeps legacy link ingestion compatible by normalizing links into notes.

## Web UI

- Adds a live note composer for creating and editing notes.
- Moves note creation into a modal-style overlay instead of rendering the form inline with cards.
- Supports editing existing notes and re-submitting them to the backend.
- Adds optional structured JSON data input to the composer.
- Adds source and author fields to the note composer.
- Removes table mode entirely.
- Replaces link-specific cards with note cards that support:
  - markdown rendering
  - expandable card detail view
  - compact preview rendering
  - raw API query action
  - copy action
  - edit action
  - source/type metadata badges
  - search match highlighting
- Opens URL-bearing note titles directly when clicked.
- Removes the old explicit "open URL" action.
- Hides top-right card tools until a card is expanded.
- Expands cards by clicking the card body instead of using a dedicated expand icon.
- Improves card density, markdown heading behavior, and tag layout.
- Fixes expanded card layout so structured data and tags stack without overlap.
- Normalizes protobuf timestamp objects in the UI so editing existing notes can save successfully.

## Navigation And Filtering

- Moves namespace selection into the navigation metadata area.
- Models namespaces as tab-like controls.
- Smooths namespace transitions to reduce jarring content swaps.
- Adds a namespace finder for larger namespace sets.
- Refactors namespace creation into the add-note flow.
- Requires an initial note when creating a new namespace through the UI.
- Makes top tags collapsible.
- Moves the tag summary/chevron below namespace tabs.
- Improves tag ergonomics with compact pills and match highlighting.

## Search

- Keeps notes searchable by text and tags.
- Searches note title, body, URL, tags, and structured data through the existing search path.
- Adds exact-note raw retrieval links from expanded cards.
- Improves namespace-aware search/index behavior so search results resolve against the selected namespace.

## MCP

- Adds a `cartographer mcp` command backed by a live Cartographer gRPC server.
- Adds an MCP stdio server with tools for:
  - listing namespaces
  - searching notes
  - fetching an exact note
  - adding notes
- Includes metadata and structured data in MCP note payloads.
- Adds tests for MCP initialization, search, and note creation.

## Backend And API

- Adds `/v1/notes` support for live note submission from the web UI.
- Extends note create/update payloads to include structured data and metadata.
- Updates server add behavior to apply metadata defaults.
- Updates cache and search indexing behavior for namespace-qualified note IDs.
- Improves namespace cache helpers and tests.
- Updates generated protobuf files for note model changes.
- Updates Swagger handling and generated docs.

## Test Data Generation

- Updates `cartographer test generate` to produce note-like markdown content.
- Adds profiles and body-size controls for stress testing the UI.
- Adds generated structured data.
- Adds URL-bearing generated notes.
- Adds multi-namespace generation support.
- Adds `--output-dir` to write one generated config per namespace.
- Updates `task generate` to generate sample data across multiple namespaces.

## Dependencies And Tooling

- Bumps project dependencies.
- Updates the TypeScript build target/configuration.
- Runs Go modernization fixes.
- Removes unused table/list UI option code.

## Documentation

- Adds authentication strategy notes covering API key format, storage, validation, operations, and UI/API split.
