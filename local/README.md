# Cartographer Local

This directory is a Docker Compose model for running Cartographer locally with persistent state. It keeps the Docker runtime config, HTTPS proxy, database mount, and backup commands in one place so a local instance behaves predictably across restarts.

The important file is `local/data/cartographer.db`. The default project example uses `/tmp/cartographer.db`, which is easy to lose during cleanup or reboot workflows. These local configs point BoltDB at this directory instead.

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
