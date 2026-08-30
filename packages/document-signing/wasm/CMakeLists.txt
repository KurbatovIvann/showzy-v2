cmake_minimum_required(VERSION 3.17)

project(uapki-wasm LANGUAGES C CXX)

set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(UAPKI_LIBS_TYPE STATIC)
set(UAPKI_CM_PKCS12_LIB_TYPE STATIC)

set(UAPKI_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)
set(PATH_UAPKIC ${UAPKI_ROOT}/uapkic)
set(PATH_UAPKIF ${UAPKI_ROOT}/uapkif)
set(PATH_UAPKI ${UAPKI_ROOT}/uapki)
set(PATH_CM_PKCS12 ${UAPKI_ROOT}/cm-pkcs12)
set(PATH_COMMON_CMAPI ${UAPKI_ROOT}/common/cm-api)
set(PATH_COMMON_JSON ${UAPKI_ROOT}/common/json)
set(PATH_COMMON_LOADERS ${UAPKI_ROOT}/common/loaders)
set(PATH_COMMON_MACROS ${UAPKI_ROOT}/common/macros)
set(PATH_COMMON_PKIX ${UAPKI_ROOT}/common/pkix)
set(PATH_WASM_SRC ${CMAKE_CURRENT_SOURCE_DIR}/src)

# ---------------------------------------------------------------------------
# uapkic  (crypto primitives, C99)
# ---------------------------------------------------------------------------
aux_source_directory(${PATH_UAPKIC}/src UAPKIC_SOURCES)

add_library(uapkic STATIC ${UAPKIC_SOURCES})
target_include_directories(uapkic PUBLIC ${PATH_UAPKIC} ${PATH_UAPKIC}/include)
target_compile_definitions(uapkic PRIVATE UAPKIC_LIBRARY UAPKIC_SELF_TEST)

# ---------------------------------------------------------------------------
# uapkif  (ASN.1, C99)
# ---------------------------------------------------------------------------
aux_source_directory(${PATH_UAPKIF}/src/asn1 UAPKIF_ASN1_SOURCES)
aux_source_directory(${PATH_UAPKIF}/src/struct UAPKIF_STRUCT_SOURCES)

add_library(uapkif STATIC ${UAPKIF_ASN1_SOURCES} ${UAPKIF_STRUCT_SOURCES})
target_include_directories(uapkif PUBLIC
    ${PATH_UAPKIF}
    ${PATH_UAPKIF}/asn1
    ${PATH_UAPKIF}/include
    ${PATH_UAPKIF}/src/asn1
)
target_compile_definitions(uapkif PRIVATE UAPKIF_LIBRARY)
target_link_libraries(uapkif PUBLIC uapkic)

# ---------------------------------------------------------------------------
# cm-pkcs12  (PKCS#12 key storage, C/C++)
# ---------------------------------------------------------------------------
aux_source_directory(${PATH_CM_PKCS12}/src CMP12_SRC_SOURCES)
aux_source_directory(${PATH_CM_PKCS12}/src/crypto CMP12_CRYPTO_SOURCES)
aux_source_directory(${PATH_CM_PKCS12}/src/storage CMP12_STORAGE_SOURCES)
aux_source_directory(${PATH_COMMON_JSON} CMP12_JSON_SOURCES)
set(CMP12_COMMON_SOURCES
    ${PATH_COMMON_PKIX}/aid.c
    ${PATH_COMMON_PKIX}/ba-utils.c
    ${PATH_COMMON_PKIX}/dstu4145-params.c
    ${PATH_COMMON_PKIX}/iconv-utils.c
    ${PATH_COMMON_PKIX}/iso15946.c
    ${PATH_COMMON_PKIX}/key-wrap.c
    ${PATH_COMMON_PKIX}/oids.c
    ${PATH_COMMON_PKIX}/oid-utils.c
    ${PATH_COMMON_PKIX}/private-key.c
    ${PATH_COMMON_PKIX}/uapki-ns-util.cpp
)

add_library(cm-pkcs12 STATIC
    ${CMP12_CRYPTO_SOURCES}
    ${CMP12_SRC_SOURCES}
    ${CMP12_STORAGE_SOURCES}
    ${CMP12_COMMON_SOURCES}
    ${CMP12_JSON_SOURCES}
)
target_include_directories(cm-pkcs12 PUBLIC
    ${PATH_COMMON_CMAPI}
    ${PATH_COMMON_JSON}
    ${PATH_COMMON_MACROS}
    ${PATH_COMMON_PKIX}
    ${PATH_CM_PKCS12}/src
    ${PATH_CM_PKCS12}/src/crypto
    ${PATH_CM_PKCS12}/src/storage
)
target_compile_definitions(cm-pkcs12 PRIVATE CM_LIBRARY)
target_link_libraries(cm-pkcs12 PUBLIC uapkic uapkif)

# ---------------------------------------------------------------------------
# uapki  (main PKI library, C/C++) -- Emscripten build
# ---------------------------------------------------------------------------
aux_source_directory(${PATH_UAPKI}/src/api UAPKI_API_SOURCES)
aux_source_directory(${PATH_UAPKI}/src UAPKI_SOURCES)
aux_source_directory(${PATH_COMMON_JSON} UAPKI_JSON_SOURCES)

file(GLOB UAPKI_COMMON_PKIX_SOURCES "${PATH_COMMON_PKIX}/*.c" "${PATH_COMMON_PKIX}/*.cpp")
list(FILTER UAPKI_COMMON_PKIX_SOURCES EXCLUDE REGEX "http-helper\\.cpp$")

add_library(uapki STATIC
    ${UAPKI_API_SOURCES}
    ${UAPKI_SOURCES}
    ${UAPKI_COMMON_PKIX_SOURCES}
    ${UAPKI_JSON_SOURCES}
    ${PATH_WASM_SRC}/http-helper-emscripten.cpp
    ${PATH_WASM_SRC}/cm-loader-emscripten.cpp
)

target_include_directories(uapki PUBLIC
    ${PATH_COMMON_CMAPI}
    ${PATH_COMMON_JSON}
    ${PATH_COMMON_MACROS}
    ${PATH_COMMON_PKIX}
    ${PATH_COMMON_LOADERS}
    ${PATH_UAPKI}
    ${PATH_UAPKI}/src
    ${PATH_UAPKI}/src/api
    ${PATH_UAPKI}/include
)
target_compile_definitions(uapki PRIVATE UAPKI_LIBRARY)
target_link_libraries(uapki PUBLIC uapkic uapkif cm-pkcs12)

# ---------------------------------------------------------------------------
# Final WASM executable (linked as a single .wasm + .js)
# ---------------------------------------------------------------------------
add_executable(uapki_wasm ${PATH_WASM_SRC}/wasm-exports.cpp)
target_link_libraries(uapki_wasm PRIVATE uapki uapkic uapkif cm-pkcs12)
target_include_directories(uapki_wasm PRIVATE ${PATH_UAPKI}/include)

set_target_properties(uapki_wasm PROPERTIES
    OUTPUT_NAME "uapki"
    SUFFIX ".js"
)

target_link_options(uapki_wasm PRIVATE
    "SHELL:-s EXPORTED_FUNCTIONS=['_process','_json_free','_set_cors_proxy_url','_malloc','_free']"
    "SHELL:-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','stringToUTF8','lengthBytesUTF8','setValue','getValue','HEAPU8','FS']"
    "SHELL:-s MODULARIZE=1"
    "SHELL:-s EXPORT_NAME='createUapkiModule'"
    "SHELL:-s ENVIRONMENT='web,worker,node'"
    "SHELL:-s ALLOW_MEMORY_GROWTH=1"
    "SHELL:-s INITIAL_MEMORY=33554432"
    "SHELL:-s FILESYSTEM=1"
    "SHELL:-s FORCE_FILESYSTEM=1"
    "SHELL:-s NO_EXIT_RUNTIME=1"
    "SHELL:-s SINGLE_FILE=0"
    "SHELL:-s WASM=1"
    "SHELL:-s ASSERTIONS=0"
    -O2
)
