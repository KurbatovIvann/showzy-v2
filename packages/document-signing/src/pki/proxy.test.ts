import { describe, expect, it } from "vitest";

import { PKI_PROXY_PATH, unwrapProxyResponse } from "./proxy.js";

describe("unwrapProxyResponse", () => {
  it("accepts the v2 raw proxy body", () => {
    expect(
      unwrapProxyResponse({
        status: 200,
        bodyBase64: "Zg==",
        contentType: "text/plain",
      }),
    ).toEqual({ status: 200, bodyBase64: "Zg==", contentType: "text/plain" });
  });

  it("accepts a wrapped interceptor body without requiring it", () => {
    expect(
      unwrapProxyResponse({
        success: true,
        data: { status: 404, bodyBase64: "" },
      }),
    ).toEqual({ status: 404, bodyBase64: "" });
  });

  it("rejects a non-object", () => {
    expect(() => unwrapProxyResponse("nope")).toThrow(
      /PKI proxy response is not an object/,
    );
  });

  it("rejects an object without status", () => {
    expect(() => unwrapProxyResponse({ success: true })).toThrow(
      /PKI proxy response missing status/,
    );
  });
});

describe("PKI_PROXY_PATH", () => {
  it("is the v2 POST /pki/proxy path", () => {
    expect(PKI_PROXY_PATH).toBe("/pki/proxy");
    expect(PKI_PROXY_PATH).not.toContain("/api/v1/");
  });
});
