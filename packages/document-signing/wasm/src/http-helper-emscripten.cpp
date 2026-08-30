/*
 * Emscripten replacement for http-helper.cpp
 * Uses EM_JS to perform synchronous XHR in a Web Worker context,
 * replacing libcurl for OCSP/TSA HTTP requests.
 */

#include <emscripten.h>
#include "ba-utils.h"
#include "http-helper.h"
#include "uapkic.h"
#include "uapki-errors.h"
#include "uapki-ns.h"
#include <string.h>
#include <map>
#include <mutex>

using namespace std;

const char* HttpHelper::CONTENT_TYPE_APP_JSON     = "Content-Type:application/json";
const char* HttpHelper::CONTENT_TYPE_OCSP_REQUEST = "Content-Type:application/ocsp-request";
const char* HttpHelper::CONTENT_TYPE_TSP_REQUEST  = "Content-Type:application/timestamp-query";

static struct {
    bool isInitialized;
    bool offlineMode;
    string proxyUrl;
    mutex mtx;
    map<string, mutex> mtxByUrl;
} http_state;

/*
 * The CORS proxy URL is set from JavaScript via setCorsProxyUrl().
 * When set, all HTTP requests are routed through the proxy as JSON POST:
 *   POST <corsProxyUrl>  body: { url, contentType?, body? (base64) }
 * The proxy returns: { status, contentType, bodyBase64 }
 */
EM_JS(void, js_set_cors_proxy_url, (const char* url), {
    Module['_corsProxyUrl'] = UTF8ToString(url);
});

EM_JS(int, js_http_get, (const char* url, uint8_t** outData, int* outLen), {
    try {
        var targetUrl = UTF8ToString(url);
        var proxyUrl = Module['_corsProxyUrl'] || '';
        var xhr = new XMLHttpRequest();

        if (proxyUrl) {
            xhr.open('POST', proxyUrl, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'text';
            xhr.send(JSON.stringify({ url: targetUrl }));
            if (xhr.status !== 200) return -1;
            var proxyResp = JSON.parse(xhr.responseText);
            if (proxyResp.data) proxyResp = proxyResp.data;
            if (proxyResp.status !== 200) return -1;
            var binary = atob(proxyResp.bodyBase64);
            var resp = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) resp[i] = binary.charCodeAt(i);
        } else {
            xhr.open('GET', targetUrl, false);
            xhr.responseType = 'arraybuffer';
            xhr.send(null);
            if (xhr.status !== 200) return -1;
            var resp = new Uint8Array(xhr.response);
        }

        var ptr = _malloc(resp.length);
        if (!ptr) return -2;
        HEAPU8.set(resp, ptr);
        setValue(outData, ptr, '*');
        setValue(outLen, resp.length, 'i32');
        return 0;
    } catch (e) {
        return -1;
    }
});

EM_JS(int, js_http_post, (const char* url, const char* contentType,
                           const uint8_t* data, int dataLen,
                           uint8_t** outData, int* outLen), {
    try {
        var targetUrl = UTF8ToString(url);
        var ct = UTF8ToString(contentType);
        var proxyUrl = Module['_corsProxyUrl'] || '';
        var xhr = new XMLHttpRequest();
        var reqBytes = HEAPU8.slice(data, data + dataLen);

        if (proxyUrl) {
            var bodyB64 = '';
            var binary = '';
            for (var i = 0; i < reqBytes.length; i++) binary += String.fromCharCode(reqBytes[i]);
            bodyB64 = btoa(binary);

            var parsedCt = ct;
            if (ct.indexOf(':') !== -1) {
                var parts = ct.split(':');
                parsedCt = parts[1].trim();
            }

            xhr.open('POST', proxyUrl, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'text';
            xhr.send(JSON.stringify({ url: targetUrl, contentType: parsedCt, body: bodyB64 }));
            if (xhr.status !== 200) return -1;
            var proxyResp = JSON.parse(xhr.responseText);
            if (proxyResp.data) proxyResp = proxyResp.data;
            if (proxyResp.status !== 200) return -1;
            var decoded = atob(proxyResp.bodyBase64);
            var resp = new Uint8Array(decoded.length);
            for (var i = 0; i < decoded.length; i++) resp[i] = decoded.charCodeAt(i);
        } else {
            xhr.open('POST', targetUrl, false);
            if (ct.indexOf(':') !== -1) {
                var parts = ct.split(':');
                xhr.setRequestHeader(parts[0].trim(), parts[1].trim());
            } else {
                xhr.setRequestHeader('Content-Type', ct);
            }
            xhr.responseType = 'arraybuffer';
            xhr.send(reqBytes);
            if (xhr.status !== 200) return -1;
            var resp = new Uint8Array(xhr.response);
        }

        var ptr = _malloc(resp.length);
        if (!ptr) return -2;
        HEAPU8.set(resp, ptr);
        setValue(outData, ptr, '*');
        setValue(outLen, resp.length, 'i32');
        return 0;
    } catch (e) {
        return -1;
    }
});

EM_JS(int, js_http_post_str, (const char* url, const char* contentType,
                               const char* authBearer,
                               const char* bodyStr,
                               uint8_t** outData, int* outLen), {
    try {
        var targetUrl = UTF8ToString(url);
        var ct = UTF8ToString(contentType);
        var auth = UTF8ToString(authBearer);
        var body = UTF8ToString(bodyStr);
        var proxyUrl = Module['_corsProxyUrl'] || '';
        var xhr = new XMLHttpRequest();

        if (proxyUrl) {
            var bodyB64 = '';
            if (body.length > 0) {
                var binary = '';
                var encoder = new TextEncoder();
                var encoded = encoder.encode(body);
                for (var i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
                bodyB64 = btoa(binary);
            }
            var parsedCt = ct;
            if (ct.indexOf(':') !== -1) {
                var parts = ct.split(':');
                parsedCt = parts[1].trim();
            }

            xhr.open('POST', proxyUrl, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.responseType = 'text';
            xhr.send(JSON.stringify({ url: targetUrl, contentType: parsedCt, body: bodyB64 }));
            if (xhr.status !== 200) return -1;
            var proxyResp = JSON.parse(xhr.responseText);
            if (proxyResp.data) proxyResp = proxyResp.data;
            if (proxyResp.status !== 200) return -1;
            var decoded = atob(proxyResp.bodyBase64);
            var resp = new Uint8Array(decoded.length);
            for (var i = 0; i < decoded.length; i++) resp[i] = decoded.charCodeAt(i);
        } else {
            xhr.open('POST', targetUrl, false);
            if (ct.indexOf(':') !== -1) {
                var parts = ct.split(':');
                xhr.setRequestHeader(parts[0].trim(), parts[1].trim());
            } else {
                xhr.setRequestHeader('Content-Type', ct);
            }
            if (auth.length > 0) {
                xhr.setRequestHeader('Authorization', auth);
            }
            xhr.responseType = 'arraybuffer';
            xhr.send(body.length > 0 ? body : null);
            if (xhr.status !== 200) return -1;
            var resp = new Uint8Array(xhr.response);
        }

        var ptr = _malloc(resp.length);
        if (!ptr) return -2;
        HEAPU8.set(resp, ptr);
        setValue(outData, ptr, '*');
        setValue(outLen, resp.length, 'i32');
        return 0;
    } catch (e) {
        return -1;
    }
});


extern "C" {
    void set_cors_proxy_url(const char* url) {
        js_set_cors_proxy_url(url);
    }
}

int HttpHelper::init (
        const bool offlineMode,
        const char* proxyUrl,
        const char* proxyCredentials
)
{
    http_state.offlineMode = offlineMode;
    if (!http_state.isInitialized) {
        http_state.isInitialized = true;
        if (proxyUrl) {
            http_state.proxyUrl = string(proxyUrl);
        }
    }
    return RET_OK;
}

void HttpHelper::deinit (void)
{
    http_state.isInitialized = false;
    http_state.offlineMode = false;
    http_state.proxyUrl.clear();
}

bool HttpHelper::isOfflineMode (void)
{
    return http_state.offlineMode;
}

const string& HttpHelper::getProxyUrl (void)
{
    return http_state.proxyUrl;
}

int HttpHelper::get (
        const string& uri,
        ByteArray** baResponse
)
{
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }

    uint8_t* respData = nullptr;
    int respLen = 0;

    int rc = js_http_get(uri.c_str(), &respData, &respLen);
    if (rc != 0 || !respData) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    *baResponse = ba_alloc_from_uint8(respData, (size_t)respLen);
    free(respData);

    return (*baResponse) ? RET_OK : RET_UAPKI_GENERAL_ERROR;
}

int HttpHelper::post (
        const string& uri,
        const char* contentType,
        const ByteArray* baRequest,
        ByteArray** baResponse
)
{
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }

    const uint8_t* reqBuf = ba_get_buf_const(baRequest);
    size_t reqLen = ba_get_len(baRequest);
    uint8_t* respData = nullptr;
    int respLen = 0;

    int rc = js_http_post(uri.c_str(), contentType, reqBuf, (int)reqLen,
                          &respData, &respLen);
    if (rc != 0 || !respData) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    *baResponse = ba_alloc_from_uint8(respData, (size_t)respLen);
    free(respData);

    return (*baResponse) ? RET_OK : RET_UAPKI_GENERAL_ERROR;
}

int HttpHelper::post (
        const string& uri,
        const char* contentType,
        const char* userPwd,
        const string& authorizationBearer,
        const string& request,
        ByteArray** baResponse
)
{
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }

    uint8_t* respData = nullptr;
    int respLen = 0;

    int rc = js_http_post_str(uri.c_str(), contentType,
                              authorizationBearer.c_str(),
                              request.c_str(),
                              &respData, &respLen);
    if (rc != 0 || !respData) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    *baResponse = ba_alloc_from_uint8(respData, (size_t)respLen);
    free(respData);

    return (*baResponse) ? RET_OK : RET_UAPKI_GENERAL_ERROR;
}

mutex& HttpHelper::lockUri (
        const string& uri
)
{
    lock_guard<mutex> lock(http_state.mtx);
    return http_state.mtxByUrl[uri];
}

vector<string> HttpHelper::randomURIs (
        const vector<string>& uris
)
{
    if (uris.size() < 2) return uris;

    UapkiNS::SmartBA sba_randoms;
    if (!sba_randoms.set(ba_alloc_by_len(uris.size() - 1))) return uris;

    if (drbg_random(sba_randoms.get()) != RET_OK) return uris;

    vector<string> rv_uris, src = uris;
    const uint8_t* buf = sba_randoms.buf();
    for (size_t i = 0; i < uris.size() - 1; i++) {
        const size_t rnd = buf[i] % src.size();
        rv_uris.push_back(src[rnd]);
        src.erase(src.begin() + rnd);
    }
    rv_uris.push_back(src[0]);
    return rv_uris;
}
