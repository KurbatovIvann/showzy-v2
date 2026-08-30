require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "DocumentSigning"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/showzy"
  s.license      = "UNLICENSED"
  s.authors      = "Showzy"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/showzy.git", :tag => s.version.to_s }

  s.source_files = [
    "ios/**/*.{h,m,mm,cpp,hpp}",
    "cpp-bridge/**/*.{h,hpp,cpp}",
    "cpp/uapkic/**/*.{c,cpp,h,hpp}",
    "cpp/uapkif/**/*.{c,cpp,h,hpp}",
    "cpp/uapki/**/*.{c,cpp,h,hpp}",
    "cpp/cm-pkcs12/**/*.{c,cpp,h,hpp}",
    "cpp/common/**/*.{c,cpp,h,hpp}",
  ]

  s.exclude_files = [
    "cpp/common/pkix/http-helper.cpp",
    "cpp/common/loaders/cm-loader.cpp",
    "cpp/common/cryptoki/**",
  ]

  # Keep UAPKI C headers out of the Clang module map. `Hash.h` (ASN.1) and
  # `hash.h` (crypto) collide on case-insensitive APFS when USE_HEADERMAP is on.
  s.private_header_files = [
    "cpp/**/*.h",
    "cpp/**/*.hpp",
    "cpp-bridge/**/*.{h,hpp}",
    "ios/**/*.{h,hpp}",
  ]

  s.libraries = ['iconv']

  # Set xcconfig BEFORE add_nitrogen_files so Nitro merges its settings
  # (C++20, Swift interop, DEFINES_MODULE) into ours instead of being overwritten.
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => [
      "$(PODS_TARGET_SRCROOT)/cpp/uapkif/include",
      "$(PODS_TARGET_SRCROOT)/cpp/uapkif",
      "$(PODS_TARGET_SRCROOT)/cpp/uapkif/asn1",
      "$(PODS_TARGET_SRCROOT)/cpp/uapkif/src/asn1",
      "$(PODS_TARGET_SRCROOT)/cpp/uapkic",
      "$(PODS_TARGET_SRCROOT)/cpp/uapkic/include",
      "$(PODS_TARGET_SRCROOT)/cpp/uapki",
      "$(PODS_TARGET_SRCROOT)/cpp/uapki/include",
      "$(PODS_TARGET_SRCROOT)/cpp/uapki/src",
      "$(PODS_TARGET_SRCROOT)/cpp/uapki/src/api",
      "$(PODS_TARGET_SRCROOT)/cpp/cm-pkcs12/src",
      "$(PODS_TARGET_SRCROOT)/cpp/cm-pkcs12/src/crypto",
      "$(PODS_TARGET_SRCROOT)/cpp/cm-pkcs12/src/storage",
      "$(PODS_TARGET_SRCROOT)/cpp/common/cm-api",
      "$(PODS_TARGET_SRCROOT)/cpp/common/json",
      "$(PODS_TARGET_SRCROOT)/cpp/common/macros",
      "$(PODS_TARGET_SRCROOT)/cpp/common/pkix",
      "$(PODS_TARGET_SRCROOT)/cpp/common/loaders",
    ].join(" "),
    "GCC_PREPROCESSOR_DEFINITIONS" => "UAPKI_LIBRARY UAPKIC_LIBRARY UAPKIC_SELF_TEST UAPKIF_LIBRARY CM_LIBRARY",
    "GCC_WARN_INHIBIT_ALL_WARNINGS" => "YES",
    # Keep header maps on so Swift can import NitroModules (AnyMap.hpp).
    # Hash.c uses a path-relative include so APFS cannot mix Hash.h / hash.h.
    "OTHER_CFLAGS" => "-UDEBUG -iquote \"$(PODS_TARGET_SRCROOT)/cpp/uapkif/include\"",
  }

  # Nitrogen autolinking -- MUST come after pod_target_xcconfig so it merges
  # its required settings (C++20, SWIFT_OBJC_INTEROP_MODE, DEFINES_MODULE)
  # into the existing xcconfig rather than being overwritten.
  load File.join(__dir__, 'nitrogen', 'generated', 'ios', 'DocumentSigning+autolinking.rb')
  add_nitrogen_files(s)

end
