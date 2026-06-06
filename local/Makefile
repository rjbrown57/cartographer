SHELL := /bin/sh

LOCAL_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
REPO_DIR := $(abspath $(LOCAL_DIR)/..)
CONFIG_DIR := $(LOCAL_DIR)/config
DATA_DIR := $(LOCAL_DIR)/data
BACKUP_DIR := $(LOCAL_DIR)/backups
DB_PATH := $(DATA_DIR)/cartographer.db
CERT_DIR := $(LOCAL_DIR)/certs
TLS_CERT := $(CERT_DIR)/cartographer.localhost.pem
TLS_KEY := $(CERT_DIR)/cartographer.localhost-key.pem
ADMIN_TOKEN ?= admin

.PHONY: help setup deps resolve-deps certs docker-up docker-down docker-logs backup restore list-backups status reset-data

help:
	@printf '%s\n' 'Cartographer local Docker Compose runtime'
	@printf '%s\n' ''
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  setup        create local data and backup directories'
	@printf '%s\n' '  deps         verify Docker Compose and mkcert are available'
	@printf '%s\n' '  resolve-deps install or explain missing local runtime dependencies'
	@printf '%s\n' '  certs        create trusted local TLS certs with mkcert'
	@printf '%s\n' '  docker-up    run Cartographer behind the local HTTPS proxy'
	@printf '%s\n' '  docker-down  stop the local Docker Compose stack'
	@printf '%s\n' '  docker-logs  follow local Docker Compose logs for all services'
	@printf '%s\n' '  status       show local config, db, backup, and cert locations'
	@printf '%s\n' '  backup       copy the BoltDB file into local/backups'
	@printf '%s\n' '  list-backups show available local database backups'
	@printf '%s\n' '  restore      restore BACKUP=/path/to/file.db into local/data/cartographer.db'
	@printf '%s\n' '  reset-data   backup then remove db; requires CONFIRM=erase'
	@printf '%s\n' ''
	@printf '%s\n' 'Web UI: https://cartographer.localhost'

setup:
	@mkdir -p "$(CONFIG_DIR)" "$(DATA_DIR)" "$(BACKUP_DIR)" "$(CERT_DIR)"
	@printf 'Local data directory: %s\n' "$(DATA_DIR)"

deps:
	@if ! command -v docker >/dev/null 2>&1; then \
		printf 'docker is required to run the local Docker Compose stack.\n'; \
		printf 'Run: make -C local resolve-deps\n'; \
		exit 2; \
	fi
	@if ! docker compose version >/dev/null 2>&1; then \
		printf 'docker compose is required to run the local Docker Compose stack.\n'; \
		printf 'Run: make -C local resolve-deps\n'; \
		exit 2; \
	fi
	@if ! command -v mkcert >/dev/null 2>&1; then \
		printf 'mkcert is required to create a trusted local certificate.\n'; \
		printf 'Run: make -C local resolve-deps\n'; \
		exit 2; \
	fi

resolve-deps:
	@if ! command -v docker >/dev/null 2>&1; then \
		printf 'Docker Desktop is required for the local Docker Compose stack.\n'; \
		printf 'Install Docker Desktop, start it, then run: make -C local deps\n'; \
	else \
		printf 'docker: ok\n'; \
	fi
	@if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then \
		printf 'docker compose: ok\n'; \
	elif command -v docker >/dev/null 2>&1; then \
		printf 'docker compose is missing or unavailable. Update Docker Desktop, then run: make -C local deps\n'; \
	fi
	@if ! command -v mkcert >/dev/null 2>&1; then \
		if command -v brew >/dev/null 2>&1; then \
			brew install mkcert; \
		else \
			printf 'mkcert is required and Homebrew is not available to install it automatically.\n'; \
			printf 'Install mkcert, then run: make -C local deps\n'; \
			exit 2; \
		fi; \
	else \
		printf 'mkcert: ok\n'; \
	fi
	@$(MAKE) deps

certs: setup deps
	@mkcert -install
	@mkcert -cert-file "$(TLS_CERT)" -key-file "$(TLS_KEY)" cartographer.localhost localhost 127.0.0.1 ::1
	@printf 'Local TLS cert: %s\n' "$(TLS_CERT)"

docker-up: setup deps certs
	cd "$(LOCAL_DIR)" && CARTOGRAPHER_ADMIN_TOKEN="$(ADMIN_TOKEN)" docker compose up -d

docker-down:
	cd "$(LOCAL_DIR)" && docker compose down

docker-logs:
	cd "$(LOCAL_DIR)" && docker compose logs -f

backup: setup
	@if [ -f "$(DB_PATH)" ]; then \
		stamp=$$(date +%Y%m%d-%H%M%S); \
		cp "$(DB_PATH)" "$(BACKUP_DIR)/cartographer-$$stamp.db"; \
		printf 'Backed up %s\n' "$(BACKUP_DIR)/cartographer-$$stamp.db"; \
	else \
		printf 'No database exists at %s yet.\n' "$(DB_PATH)"; \
	fi

restore: setup
	@if [ -z "$(BACKUP)" ]; then \
		printf 'Usage: make restore BACKUP=/absolute/or/relative/path/to/cartographer.db\n'; \
		exit 2; \
	fi
	@if [ ! -f "$(BACKUP)" ]; then \
		printf 'Backup not found: %s\n' "$(BACKUP)"; \
		exit 2; \
	fi
	@if [ -f "$(DB_PATH)" ]; then \
		$(MAKE) backup; \
	fi
	cp "$(BACKUP)" "$(DB_PATH)"
	@printf 'Restored %s to %s\n' "$(BACKUP)" "$(DB_PATH)"

list-backups:
	@find "$(BACKUP_DIR)" -maxdepth 1 -type f -name '*.db' -print 2>/dev/null | sort || true

status: setup
	@printf 'Local config: %s\n' "$(CONFIG_DIR)"
	@printf 'Local db:     %s\n' "$(DB_PATH)"
	@printf 'Backups:      %s\n' "$(BACKUP_DIR)"
	@printf 'TLS cert:     %s\n' "$(TLS_CERT)"
	@printf 'TLS key:      %s\n' "$(TLS_KEY)"
	@if [ -f "$(DB_PATH)" ]; then ls -lh "$(DB_PATH)"; else printf 'Database has not been created yet.\n'; fi
	@if [ -f "$(TLS_CERT)" ]; then ls -lh "$(TLS_CERT)"; else printf 'TLS certificate has not been created yet.\n'; fi

reset-data:
	@if [ "$(CONFIRM)" != "erase" ]; then \
		printf 'Refusing to remove data. Re-run with CONFIRM=erase after stopping Cartographer.\n'; \
		exit 2; \
	fi
	@$(MAKE) backup
	rm -f "$(DB_PATH)"
