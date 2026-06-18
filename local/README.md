# Cartographer Local

This directory is a Docker Compose model for running Cartographer locally with persistent state. It keeps the Docker runtime config, HTTPS proxy, database mount, and backup commands in one place so a local instance behaves predictably across restarts.

## Docker Compose

```bash
make -C local resolve-deps
make -C local deps
make -C local docker-up
make -C local docker-logs
make -C local docker-down
```

Open https://cartographer.localhost.

Docker Compose uses the published `ghcr.io/rjbrown57/cartographer:latest` image, mounts `local/config` as the only supported runtime config directory, and mounts `local/data` into the container. The web UI is served through Caddy on port 443, using the local name `cartographer.localhost`.

## MCP

Cartographer includes an MCP stdio server that lets tools such as Codex query and update a running Cartographer instance. Run the local Docker Compose stack first; it starts the web UI, the backing gRPC server, and the persistent local database that MCP talks to.

Start the local stack first:

```bash
make -C local docker-up
```

For MCP clients, use the local Cartographer binary as the stdio MCP server. It connects to the gRPC server published by the local Compose stack on `127.0.0.1:18080`:

```bash
make -C local mcp-config
```

This prints:

```json
{
  "mcpServers": {
    "cartographer": {
      "command": "/absolute/path/to/cartographer/cartographer",
      "args": ["mcp", "--address", "127.0.0.1", "--port", "18080"]
    }
  }
}
```

You can also run the MCP stdio server directly for manual testing:

```bash
make -C local mcp
```

This target runs:

```bash
./cartographer mcp --address 127.0.0.1 --port 18080
```

If you do not have a local binary yet, build one from the repository root:

```bash
go build -o cartographer .
```

The MCP server exposes tools to list namespaces, search notes, fetch an exact note, and add a note. `cartographer_add_note` writes to the live local database in `local/data/cartographer.db`, so use it with the same care as the web UI.

## Local TLS

The proxy expects trusted local certificates in `local/certs`. Generate them with:

```bash
make -C local certs
```

This requires `mkcert`. Run `make -C local resolve-deps` to install it with Homebrew when possible. The `docker-up` target also runs `certs`, so the first startup will fail with install instructions if `mkcert` is not available.

`cartographer.localhost` resolves to `127.0.0.1` without an `/etc/hosts` entry on modern systems. To use a different local name, update `Caddyfile`, the `certs` target in `Makefile`, and add the name to `/etc/hosts` if it does not already resolve locally.

## Backups

```bash
make -C local backup
make -C local list-backups
make -C local restore BACKUP=local/backups/cartographer-YYYYMMDD-HHMMSS.db
```

`reset-data` refuses to run unless you pass `CONFIRM=erase`, and it takes a backup first.
