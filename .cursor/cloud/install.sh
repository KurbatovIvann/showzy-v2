#!/usr/bin/env bash
#
# Idempotent install/bootstrap for the Showzy 2.0 Cloud Agent environment.
#
# Runs after the repository is checked out. It prepares the durable state the
# development stack and test suite depend on:
#   1. Docker Engine + the fuse-overlayfs storage driver (the local dev stack
#      and Testcontainers-based tests both need a working daemon inside this
#      nested-container VM);
#   2. the /etc/docker/daemon.json that pins the fuse-overlayfs driver;
#   3. workspace JavaScript dependencies (pnpm, frozen lockfile).
#
# Nothing here starts a long-running process — the daemon and the dev stack are
# brought up per boot by start.sh. Safe to re-run: every step is a no-op when
# the state it creates already exists.
set -euo pipefail

cd "$(dirname "$0")/../.." # repo root

log() { printf '[install] %s\n' "$*"; }

# --- 1. Docker Engine + fuse-overlayfs --------------------------------------
# Cloud Agent VMs are themselves containers, so the default overlay2 driver is
# unavailable; fuse-overlayfs is the supported rootful driver here. Install the
# packages only when the docker binary is missing so snapshot/build boots that
# already carry them skip straight to dependency install.
if ! command -v dockerd >/dev/null 2>&1; then
  log "installing docker engine + fuse-overlayfs"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    -o Dpkg::Options::="--force-confold" \
    docker.io docker-compose-v2 fuse-overlayfs fuse3 uidmap iptables
else
  log "docker already installed: $(dockerd --version)"
fi

# --- 2. Daemon storage-driver config ----------------------------------------
sudo mkdir -p /etc/docker
if ! grep -q '"storage-driver": "fuse-overlayfs"' /etc/docker/daemon.json 2>/dev/null; then
  log "writing /etc/docker/daemon.json (fuse-overlayfs)"
  printf '{\n  "storage-driver": "fuse-overlayfs"\n}\n' | sudo tee /etc/docker/daemon.json >/dev/null
fi

# --- 3. Workspace dependencies ----------------------------------------------
log "installing workspace dependencies (pnpm, frozen lockfile)"
pnpm install --frozen-lockfile

log "install complete"
