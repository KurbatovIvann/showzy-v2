import { describe, expect, it } from "vitest";

import { classifyDocumentFormLoad } from "./document-form-load";

describe("classifyDocumentFormLoad", () => {
  it("blocks without documents:create before any picker or layout fetch", () => {
    expect(
      classifyDocumentFormLoad({
        canCreate: false,
        clientReady: true,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyDocumentFormLoad({
        canCreate: true,
        clientReady: true,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyDocumentFormLoad({
        canCreate: true,
        clientReady: false,
      }),
    ).toEqual({ kind: "error" });
  });
});
