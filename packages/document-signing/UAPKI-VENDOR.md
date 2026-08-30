# Vendored UAPKI

- Upstream: https://github.com/specinfo-ua/UAPKI
- Tag: v2.0.16
- Copied paths: library/{uapkic,uapkif,uapki,cm-pkcs12,common,test,hostapp}
- Not copied: library/cm-pkcs11, integration/, doc/
- Local replacements (do not overwrite from upstream):
  - wasm/src/http-helper-emscripten.cpp
  - wasm/src/cm-loader-emscripten.cpp
  - cpp-bridge/http-helper-native.cpp
  - wasm/CMakeLists.txt and android/CMakeLists.txt exclude curl http-helper.cpp
- `wasm/dist/package.json` (`"type": "commonjs"`) is a v2 overlay so Node
  can `require()` the Emscripten CJS glue from the ESM workspace package.
  Do not remove it; do not treat it as an UAPKI upstream file.
