#!/usr/bin/env bash
set -euo pipefail

WASM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BUILD_DIR="$WASM_DIR/build"
DIST_DIR="$WASM_DIR/dist"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

cd "$BUILD_DIR"

emcmake cmake "$WASM_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-Wno-all" \
    -DCMAKE_CXX_FLAGS="-Wno-all"

emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) uapki_wasm

cp "$BUILD_DIR/uapki.js"   "$DIST_DIR/uapki.js"
cp "$BUILD_DIR/uapki.wasm" "$DIST_DIR/uapki.wasm"

echo "Build complete: $DIST_DIR/uapki.js + $DIST_DIR/uapki.wasm"
