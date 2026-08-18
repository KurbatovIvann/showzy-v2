#!/usr/bin/env bash
#
# Per-boot startup for the Showzy 2.0 Cloud Agent environment.
#
# Brings up the local development infrastructure the app and tests depend on:
#   1. the Docker daemon (nested-container VM -> fuse-overlayfs storage driver,
#      pinned by /etc/docker/daemon.json from install.sh);
#   2. the docker compose dev stack (PostgreSQL 17 + Redis + MinIO), matching
#      README "Local development";
#   3. Drizzle migrations against that Postgres.
#
# Idempotent and safe to re-run: it reuses a running daemon/stack and applied
# migrations are no-ops.
set -euo pipefail

cd "$(dirname "$0")/../.." # repo root

log() { printf '[start] %s\n' "$*"; }

# --- 1. Docker daemon --------------------------------------------------------
# This VM has no systemd/service unit for Docker, so launch dockerd directly.
if ! sudo docker info >/dev/null 2>&1; then
  log "starting dockerd"
  sudo bash -c 'nohup dockerd >/var/log/dockerd.log 2>&1 & disown'
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
# Dev-only convenience: let the ubuntu user reach the daemon in the current
# session without re-login. Testcontainers and docker compose both use this
# socket. This VM is ephemeral and single-user.
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
log "docker ready: $(docker --version)"

# In this nested VM, br_netfilter routes same-network container-to-container
# traffic through the host iptables FORWARD path, where it is dropped. Disable
# bridge netfilter so intra-compose traffic (e.g. minio-init -> minio) is
# switched at layer 2. Host-published ports keep working via docker-proxy.
sudo sysctl -qw net.bridge.bridge-nf-call-iptables=0 net.bridge.bridge-nf-call-ip6tables=0 2>/dev/null || true

# --- 2. Dev stack ------------------------------------------------------------
[ -f .env ] || cp .env.example .env

log "starting compose stack (postgres, redis, minio)"
docker compose up -d

log "waiting for postgres to become healthy"
for _ in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' showzy-v2-postgres-1 2>/dev/null || echo "starting")
  [ "$status" = "healthy" ] && break
  sleep 2
done
[ "$status" = "healthy" ] || {
  log "postgres did not become healthy in time"
  docker compose ps
  exit 1
}

# --- 3. Migrations -----------------------------------------------------------
set -a
. ./.env
set +a

log "applying Drizzle migrations"
pnpm --filter @showzy/db db:migrate

log "environment ready (stack up, migrations applied)"
