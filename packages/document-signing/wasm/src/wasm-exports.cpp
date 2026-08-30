/*
 * WASM entry point — re-exports UAPKI's process() and json_free()
 * so Emscripten can find them via EXPORTED_FUNCTIONS.
 */

#include <emscripten.h>
#include "uapki-export.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE
char* process(const char* request);

EMSCRIPTEN_KEEPALIVE
void json_free(char* buf);

}
