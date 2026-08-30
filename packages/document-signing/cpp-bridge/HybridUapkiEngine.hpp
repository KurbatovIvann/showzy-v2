#pragma once

#include <functional>
#include <mutex>
#include <string>
#include "HybridUapkiEngineSpec.hpp"

// UAPKI C ABI
extern "C" {
    char* process(const char* request);
    void json_free(char* buf);
}

// Defined in http-helper-native.cpp
void NativeHttpHelper_setCallback(std::function<std::string(const std::string&)> cb);

namespace margelo::nitro::showzy::signing {

class HybridUapkiEngine : public HybridUapkiEngineSpec {
public:
    explicit HybridUapkiEngine() : HybridObject(TAG) {}

    // Runs UAPKI on a Nitro ThreadPool thread so the JS thread stays free
    // to service HTTP callbacks (OCSP, TSP, CRL) dispatched via CallInvoker.
    std::shared_ptr<Promise<std::string>> process(const std::string& jsonRequest) override {
        return Promise<std::string>::async([this, jsonRequest]() -> std::string {
            std::lock_guard<std::mutex> lock(processMutex_);
            char* result = ::process(jsonRequest.c_str());
            if (!result) {
                return R"({"errorCode":-1,"error":"process() returned null"})";
            }
            std::string response(result);
            ::json_free(result);
            return response;
        });
    }

    // Nitro double-wraps the callback: the outer Promise is the async dispatch
    // (CallInvoker → JS thread), the inner Promise is the JS fetch() result.
    void setHttpHandler(const std::function<std::shared_ptr<Promise<std::shared_ptr<Promise<std::string>>>>(const std::string&)>& handler) override {
        NativeHttpHelper_setCallback([handler](const std::string& request) -> std::string {
            auto outerPromise = handler(request);
            auto innerPromise = outerPromise->await().get();
            return innerPromise->await().get();
        });
    }

private:
    std::mutex processMutex_;
};

} // namespace margelo::nitro::showzy::signing
