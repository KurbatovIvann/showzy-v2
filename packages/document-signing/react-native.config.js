module.exports = {
  dependency: {
    platforms: {
      ios: { podspecPath: "./DocumentSigning.podspec" },
      android: {
        sourceDir: "./android",
        // Prevent Expo/RN from recursively scanning wasm/dist/uapki.js (and cpp/)
        // for codegenNativeComponent — that regex can OOM or exit 1 on EAS.
        componentDescriptors: [],
        cmakeListsPath: "CMakeLists.txt",
      },
    },
  },
};
