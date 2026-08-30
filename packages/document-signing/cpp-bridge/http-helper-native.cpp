/*
 * Native (React Native) replacement for http-helper.cpp
 * Delegates all HTTP to a JS callback registered from HybridUapkiEngine,
 * replacing libcurl. The JS side routes requests through the API proxy.
 *
 * JSON protocol (same as the CORS proxy used by web):
 *   Request:  {"method":"GET"|"POST","url":"...","contentType":"...","bodyBase64":"..."}
 *   Response: {"status":200,"bodyBase64":"..."}
 */

#include "ba-utils.h"
#include "http-helper.h"
#include "uapkic.h"
#include "uapki-errors.h"
#include "uapki-ns.h"
#include <functional>
#include <map>
#include <mutex>
#include <string>
#include <string.h>

#include "parson.h"

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

static std::function<std::string(const std::string&)> g_httpCallback;

void NativeHttpHelper_setCallback(std::function<std::string(const std::string&)> cb) {
    g_httpCallback = std::move(cb);
}

static string base64Encode(const uint8_t* data, size_t len) {
    static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    string result;
    result.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        uint32_t n = ((uint32_t)data[i]) << 16;
        if (i + 1 < len) n |= ((uint32_t)data[i + 1]) << 8;
        if (i + 2 < len) n |= (uint32_t)data[i + 2];
        result.push_back(table[(n >> 18) & 0x3F]);
        result.push_back(table[(n >> 12) & 0x3F]);
        result.push_back((i + 1 < len) ? table[(n >> 6) & 0x3F] : '=');
        result.push_back((i + 2 < len) ? table[n & 0x3F] : '=');
    }
    return result;
}

static vector<uint8_t> base64Decode(const string& b64) {
    static const int T[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    };
    vector<uint8_t> out;
    out.reserve(b64.size() * 3 / 4);
    int val = 0, valb = -8;
    for (unsigned char c : b64) {
        if (T[c] == -1) break;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            out.push_back((uint8_t)((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

static string parseContentType(const char* ct) {
    string s(ct);
    auto pos = s.find(':');
    if (pos != string::npos) {
        string val = s.substr(pos + 1);
        size_t start = val.find_first_not_of(' ');
        return (start != string::npos) ? val.substr(start) : val;
    }
    return s;
}

static int callJsHttp(const string& method, const string& url,
                       const string& contentType, const uint8_t* bodyData,
                       size_t bodyLen, ByteArray** baResponse) {
    if (!g_httpCallback) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    JSON_Value* jv_req = json_value_init_object();
    JSON_Object* jo_req = json_value_get_object(jv_req);
    json_object_set_string(jo_req, "method", method.c_str());
    json_object_set_string(jo_req, "url", url.c_str());
    if (!contentType.empty()) {
        json_object_set_string(jo_req, "contentType", contentType.c_str());
    }
    if (bodyData && bodyLen > 0) {
        string b64 = base64Encode(bodyData, bodyLen);
        json_object_set_string(jo_req, "bodyBase64", b64.c_str());
    }
    char* reqStr = json_serialize_to_string(jv_req);
    string request(reqStr);
    json_free_serialized_string(reqStr);
    json_value_free(jv_req);

    string response;
    try {
        response = g_httpCallback(request);
    } catch (...) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    JSON_Value* jv_resp = json_parse_string(response.c_str());
    if (!jv_resp) {
        return RET_UAPKI_CONNECTION_ERROR;
    }
    JSON_Object* jo_resp = json_value_get_object(jv_resp);
    int status = (int)json_object_get_number(jo_resp, "status");
    const char* bodyB64 = json_object_get_string(jo_resp, "bodyBase64");

    if (status != 200 || !bodyB64) {
        json_value_free(jv_resp);
        return RET_UAPKI_HTTP_STATUS_NOT_OK;
    }

    vector<uint8_t> decoded = base64Decode(string(bodyB64));
    json_value_free(jv_resp);

    if (decoded.empty()) {
        return RET_UAPKI_CONNECTION_ERROR;
    }

    *baResponse = ba_alloc_from_uint8(decoded.data(), decoded.size());
    return (*baResponse) ? RET_OK : RET_UAPKI_GENERAL_ERROR;
}


int HttpHelper::init(const bool offlineMode, const char* proxyUrl,
                     const char* proxyCredentials) {
    http_state.offlineMode = offlineMode;
    if (!http_state.isInitialized) {
        http_state.isInitialized = true;
        if (proxyUrl) {
            http_state.proxyUrl = string(proxyUrl);
        }
    }
    return RET_OK;
}

void HttpHelper::deinit(void) {
    http_state.isInitialized = false;
    http_state.offlineMode = false;
    http_state.proxyUrl.clear();
}

bool HttpHelper::isOfflineMode(void) {
    return http_state.offlineMode;
}

const string& HttpHelper::getProxyUrl(void) {
    return http_state.proxyUrl;
}

int HttpHelper::get(const string& uri, ByteArray** baResponse) {
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }
    return callJsHttp("GET", uri, "", nullptr, 0, baResponse);
}

int HttpHelper::post(const string& uri, const char* contentType,
                     const ByteArray* baRequest, ByteArray** baResponse) {
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }
    const uint8_t* reqBuf = ba_get_buf_const(baRequest);
    size_t reqLen = ba_get_len(baRequest);
    string ct = parseContentType(contentType);
    return callJsHttp("POST", uri, ct, reqBuf, reqLen, baResponse);
}

int HttpHelper::post(const string& uri, const char* contentType,
                     const char* userPwd, const string& authorizationBearer,
                     const string& request, ByteArray** baResponse) {
    if (http_state.offlineMode) {
        return RET_UAPKI_OFFLINE_MODE;
    }
    string ct = parseContentType(contentType);
    const uint8_t* bodyData = (const uint8_t*)request.c_str();
    size_t bodyLen = request.size();
    return callJsHttp("POST", uri, ct, bodyData, bodyLen, baResponse);
}

mutex& HttpHelper::lockUri(const string& uri) {
    lock_guard<mutex> lock(http_state.mtx);
    return http_state.mtxByUrl[uri];
}

vector<string> HttpHelper::randomURIs(const vector<string>& uris) {
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
