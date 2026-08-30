package com.showzy.signing;

import androidx.annotation.Nullable;

import com.facebook.react.TurboReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.margelo.nitro.com.showzy.signing.DocumentSigningOnLoad;

import java.util.HashMap;

public class DocumentSigningPackage extends TurboReactPackage {
  @Nullable
  @Override
  public NativeModule getModule(String name, ReactApplicationContext reactContext) {
    return null;
  }

  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return () -> {
      return new HashMap<>();
    };
  }

  static {
    DocumentSigningOnLoad.initializeNative();
  }
}
