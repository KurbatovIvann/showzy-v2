#include <fbjni/fbjni.h>
#include "DocumentSigningOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::showzy::signing::registerAllNatives();
  });
}
