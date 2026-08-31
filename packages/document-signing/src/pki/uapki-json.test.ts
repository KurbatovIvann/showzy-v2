import { describe, expect, it } from "vitest";

import { UapkiProtocolError } from "../errors.js";
import {
  keysResultSchema,
  parseUapkiResponseJson,
  parseUapkiResponseValue,
  parseUapkiResult,
  signResultSchema,
  verifyResultSchema,
} from "./uapki-json.js";

describe("UAPKI response boundary (SHO-282)", () => {
  it("parses a well-formed envelope", () => {
    const parsed = parseUapkiResponseJson(
      JSON.stringify({
        errorCode: 0,
        method: "VERIFY",
        result: { signatureInfos: [] },
      }),
      "test",
    );
    expect(parsed.errorCode).toBe(0);
    expect(parsed.method).toBe("VERIFY");
    expect(parsed.result).toEqual({ signatureInfos: [] });
  });

  it("normalizes a missing method to an empty string", () => {
    const parsed = parseUapkiResponseValue({ errorCode: 1 }, "test");
    expect(parsed.method).toBe("");
    expect(parsed.error).toBeUndefined();
    expect(parsed.result).toBeUndefined();
  });

  it("invalid JSON is a typed UapkiProtocolError, not a SyntaxError leak", () => {
    expect(() => parseUapkiResponseJson("{not json", "test")).toThrow(
      UapkiProtocolError,
    );
  });

  it("a non-numeric errorCode is a typed UapkiProtocolError, not a TypeError", () => {
    expect(() => parseUapkiResponseValue({ errorCode: "0" }, "test")).toThrow(
      UapkiProtocolError,
    );
    expect(() => parseUapkiResponseValue(null, "test")).toThrow(
      UapkiProtocolError,
    );
    expect(() => parseUapkiResponseValue([], "test")).toThrow(
      UapkiProtocolError,
    );
  });
});

describe("UAPKI result boundary (SHO-282)", () => {
  it("parses an absent result as an empty object", () => {
    expect(parseUapkiResult(signResultSchema, "SIGN", undefined)).toEqual({});
  });

  it("malformed signatures become a typed error, not a downstream TypeError", () => {
    expect(() =>
      parseUapkiResult(signResultSchema, "SIGN", { signatures: "nope" }),
    ).toThrow(UapkiProtocolError);
    expect(() =>
      parseUapkiResult(signResultSchema, "SIGN", {
        signatures: [{ bytes: 7 }],
      }),
    ).toThrow(UapkiProtocolError);
  });

  it("malformed key lists become a typed error", () => {
    expect(() =>
      parseUapkiResult(keysResultSchema, "KEYS", { keys: [{ id: 5 }] }),
    ).toThrow(UapkiProtocolError);
    expect(
      parseUapkiResult(keysResultSchema, "KEYS", { keys: [{ id: "a" }] }).keys,
    ).toEqual([{ id: "a" }]);
  });

  it("malformed signatureInfos become a typed error", () => {
    expect(() =>
      parseUapkiResult(verifyResultSchema, "VERIFY", {
        signatureInfos: [{ statusSignature: 200 }],
      }),
    ).toThrow(UapkiProtocolError);
    const parsed = parseUapkiResult(verifyResultSchema, "VERIFY", {
      signatureInfos: [{ statusSignature: "VALID", extraField: true }],
    });
    expect(parsed.signatureInfos?.[0]?.statusSignature).toBe("VALID");
  });

  it("keeps unknown extra fields (loose schemas)", () => {
    const parsed = parseUapkiResult(signResultSchema, "SIGN", {
      signatures: [{ bytes: "abc" }],
      dgst: "extra",
    });
    expect(parsed.signatures?.[0]?.bytes).toBe("abc");
  });
});
