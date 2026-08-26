import { CoreInvariantError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  createFilesObjectStore,
  filesObjectStoreErrorCause,
  normalizeObjectEtag,
} from "./s3-port.js";

describe("normalizeObjectEtag", () => {
  it("strips S3 quotes and weak-validator prefixes", () => {
    expect(normalizeObjectEtag('"abc"')).toBe("abc");
    expect(normalizeObjectEtag('W/"abc"')).toBe("abc");
    expect(normalizeObjectEtag('w/"abc"')).toBe("abc");
    expect(normalizeObjectEtag("abc")).toBe("abc");
  });
});

describe("filesObjectStoreErrorCause", () => {
  const signature =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const objectKey =
    "11111111-1111-1111-1111-111111111111/uploads/22222222-2222-2222-2222-222222222222";
  const leakingMessage = `Access Denied for ${objectKey}?X-Amz-Signature=${signature}`;

  it("keeps 403 vs timeout vs checksum as stable codes and never copies the URL", () => {
    const accessDenied = filesObjectStoreErrorCause({
      name: "AccessDenied",
      message: leakingMessage,
      $metadata: { httpStatusCode: 403 },
    });
    expect(accessDenied).toEqual({
      code: "AccessDenied",
      httpStatusCode: 403,
    });

    const timeout = filesObjectStoreErrorCause({
      name: "TimeoutError",
      message: leakingMessage,
    });
    expect(timeout).toEqual({ code: "Timeout" });

    const checksum = filesObjectStoreErrorCause({
      name: "BadDigest",
      message: leakingMessage,
      $metadata: { httpStatusCode: 400 },
    });
    expect(checksum).toEqual({
      code: "ChecksumMismatch",
      httpStatusCode: 400,
    });

    const wrapped = new CoreInvariantError(
      "files object store HeadObject failed (AccessDenied, http 403)",
      { cause: accessDenied },
    );
    const serialized = JSON.stringify({
      message: wrapped.message,
      cause: wrapped.cause,
    });
    expect(serialized).toContain("AccessDenied");
    expect(serialized).toContain("403");
    expect(serialized).not.toContain(signature);
    expect(serialized).not.toContain(objectKey);
    expect(JSON.stringify(accessDenied)).not.toContain(leakingMessage);
  });
});

describe("createFilesObjectStore signed URL host", () => {
  const localConfig = {
    endpoint: "http://127.0.0.1:3900",
    region: "us-east-1",
    accessKeyId: "showzy-local",
    secretAccessKey: "showzy-local-secret",
    forcePathStyle: true,
    bucket: "showzy",
  } as const;

  it("embeds the SDK endpoint when no public endpoint is set", async () => {
    const store = createFilesObjectStore(localConfig);
    try {
      const put = await store.signPut({
        key: "company/uploads/file",
        mimeType: "image/jpeg",
        byteSize: 12,
      });
      expect(new URL(put.url).origin).toBe("http://127.0.0.1:3900");
    } finally {
      store.close();
    }
  });

  it("embeds the public endpoint in PUT and GET URLs instead of the SDK host", async () => {
    const store = createFilesObjectStore({
      ...localConfig,
      publicEndpoint: "http://192.168.0.106:3900",
    });
    try {
      const put = await store.signPut({
        key: "company/uploads/file",
        mimeType: "image/jpeg",
        byteSize: 12,
      });
      const got = await store.signGet({
        key: "company/catalog/file",
        mimeType: "image/jpeg",
      });
      expect(new URL(put.url).origin).toBe("http://192.168.0.106:3900");
      expect(new URL(got.url).origin).toBe("http://192.168.0.106:3900");
      expect(put.url).not.toContain("127.0.0.1");
      expect(got.url).not.toContain("127.0.0.1");
    } finally {
      store.close();
    }
  });
});
