import { describe, expect, it } from "vitest";

import {
  detectAllowedImageMime,
  uploadBytesMatchDeclaredMime,
} from "./magic-bytes.js";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const heic = Uint8Array.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
]);
const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);

describe("magic bytes", () => {
  it("detects jpeg, png, and webp", () => {
    expect(detectAllowedImageMime(jpeg)).toBe("image/jpeg");
    expect(detectAllowedImageMime(png)).toBe("image/png");
    expect(detectAllowedImageMime(webp)).toBe("image/webp");
  });

  it("rejects HEIC, executables, and archives even when MIME claims an image", () => {
    expect(uploadBytesMatchDeclaredMime(heic, "image/jpeg")).toBe(false);
    expect(uploadBytesMatchDeclaredMime(exe, "image/jpeg")).toBe(false);
    expect(uploadBytesMatchDeclaredMime(zip, "image/png")).toBe(false);
    expect(detectAllowedImageMime(heic)).toBeUndefined();
    expect(detectAllowedImageMime(exe)).toBeUndefined();
  });

  it("requires the detected type to match the declared MIME", () => {
    expect(uploadBytesMatchDeclaredMime(jpeg, "image/jpeg")).toBe(true);
    expect(uploadBytesMatchDeclaredMime(jpeg, "image/png")).toBe(false);
    expect(uploadBytesMatchDeclaredMime(png, "image/webp")).toBe(false);
  });
});
