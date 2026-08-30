/*
 * Emscripten replacement for cm-loader.cpp
 * Instead of dlopen/LoadLibrary, statically links cm-pkcs12 functions.
 */

#include "cm-loader.h"
#include "uapki-errors.h"
#include <stdio.h>
#include <string.h>

using namespace std;

extern "C" {
    CM_ERROR provider_info(CM_JSON_PCHAR* providerInfo);
    CM_ERROR provider_init(CM_JSON_PCHAR providerParams);
    CM_ERROR provider_deinit(void);
    CM_ERROR provider_open(const char* uri, const uint32_t mode,
                           const CM_JSON_PCHAR params, CM_SESSION_API** session);
    CM_ERROR provider_close(CM_SESSION_API* session);
    void block_free(void* ptr);
    void bytearray_free(CM_BYTEARRAY* ba);
}

CmLoader::CmLoader (void)
{
    memset(&m_Api, 0, sizeof(CM_PROVIDER_API));
}

CmLoader::~CmLoader (void)
{
    unload();
}

string CmLoader::getLibName (
        const string& libName
)
{
    return libName;
}

bool CmLoader::load (
        const string& libName,
        const string& dir
)
{
    unload();

    m_Api.hlib = (void*)1;
    m_Api.info           = provider_info;
    m_Api.init           = provider_init;
    m_Api.deinit         = provider_deinit;
    m_Api.list_storages  = nullptr;
    m_Api.storage_info   = nullptr;
    m_Api.open           = provider_open;
    m_Api.close          = provider_close;
    m_Api.format         = nullptr;
    m_Api.block_free     = block_free;
    m_Api.bytearray_free = bytearray_free;

    return true;
}

void CmLoader::unload (void)
{
    if (isLoaded()) {
        memset(&m_Api, 0, sizeof(CM_PROVIDER_API));
    }
}

int CmLoader::info (
        CM_JSON_PCHAR* providerInfo
)
{
    return (m_Api.info) ? (int)m_Api.info(providerInfo) : RET_UAPKI_PROVIDER_NOT_LOADED;
}

int CmLoader::init (
        const CM_JSON_PCHAR providerParams
)
{
    return (m_Api.init) ? (int)m_Api.init(providerParams) : RET_UAPKI_PROVIDER_NOT_LOADED;
}

int CmLoader::deinit (void)
{
    return (m_Api.deinit) ? (int)m_Api.deinit() : RET_UAPKI_PROVIDER_NOT_LOADED;
}

int CmLoader::listStorages (
        CM_JSON_PCHAR* listUris
)
{
    return (m_Api.list_storages)
        ? (int)m_Api.list_storages(listUris)
        : (isLoaded() ? RET_UAPKI_UNSUPPORTED_CMAPI : RET_UAPKI_PROVIDER_NOT_LOADED);
}

int CmLoader::storageInfo (
        const char* uri,
        CM_JSON_PCHAR* storageInfo
)
{
    return (m_Api.storage_info)
        ? (int)m_Api.storage_info(uri, storageInfo)
        : (isLoaded() ? RET_UAPKI_UNSUPPORTED_CMAPI : RET_UAPKI_PROVIDER_NOT_LOADED);
}

int CmLoader::open (
        const char* uri,
        uint32_t mode,
        const CM_JSON_PCHAR openParams,
        CM_SESSION_API** session
)
{
    return (m_Api.open) ? (int)m_Api.open(uri, mode, openParams, session) : RET_UAPKI_PROVIDER_NOT_LOADED;
}

int CmLoader::close (
        CM_SESSION_API* session
)
{
    return (m_Api.close) ? (int)m_Api.close(session) : RET_UAPKI_PROVIDER_NOT_LOADED;
}

int CmLoader::format (
        const char* uri,
        const char* soPassword,
        const char* userPassword
)
{
    return (m_Api.format)
        ? (int)m_Api.format(uri, soPassword, userPassword)
        : (isLoaded() ? RET_UAPKI_UNSUPPORTED_CMAPI : RET_UAPKI_PROVIDER_NOT_LOADED);
}

void CmLoader::blockFree (
        void* ptr
)
{
    if (m_Api.block_free) {
        m_Api.block_free(ptr);
    }
}

void CmLoader::baFree (
        CM_BYTEARRAY* ba
)
{
    if (m_Api.bytearray_free) {
        m_Api.bytearray_free(ba);
    }
}
