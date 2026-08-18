#!/usr/bin/env bash
#
# Run the @showzy/api HTTP server (Hono + better-auth + oRPC, health at
# /health) directly from TypeScript sources for local development.
#
# The repo uses NodeNext ".js" import specifiers that point at ".ts" files;
# Node's type stripping does not remap the extension, so a dependency-free
# resolver hook bridges it (see ts-resolve/). Requires the dev stack from
# start.sh (Postgres + Redis) to be up.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/../.." # repo root

# Node's type stripping needs Node >= 22.18. The base image ships that via nvm;
# the default PATH node may be older, so select the newest installed v22.
nvm_dir="${NVM_DIR:-$HOME/.nvm}"
node_dir="$(ls -d "$nvm_dir"/versions/node/v22.* 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$node_dir" ]; then
  export PATH="$node_dir/bin:$PATH"
fi

node_major_minor="$(node -p 'process.versions.node.split(".").slice(0,2).join(".")' 2>/dev/null || echo 0.0)"
awk -v v="$node_major_minor" 'BEGIN { split(v, p, "."); if (p[1] < 22 || (p[1] == 22 && p[2] < 18)) exit 1 }' || {
  echo "[run-api] Node >= 22.18 is required for TypeScript type stripping (found $node_major_minor)" >&2
  exit 1
}

[ -f .env ] || cp .env.example .env
set -a
. ./.env
set +a

export NODE_OPTIONS="--experimental-strip-types --import ${here}/ts-resolve/register.mjs"

echo "[run-api] starting @showzy/api on port ${API_PORT:-3000} with node $(node --version)"
exec node apps/api/src/index.ts
