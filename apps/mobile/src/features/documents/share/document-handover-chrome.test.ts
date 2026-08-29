import { describe, expect, it } from "vitest";

import {
  documentHandoverHidden,
  hideDocumentHandover,
  IDLE_DOCUMENT_HANDOVER,
  openDocumentHandover,
} from "./document-handover-chrome";

describe("document handover chrome", () => {
  it("keeps the url while the sheet closes so the body does not blank mid-animation", () => {
    const open = openDocumentHandover({
      url: "https://example.test/d/token",
      documentNumber: "SHZ-РХ-000001",
    });
    const hidden = hideDocumentHandover(open);
    expect(hidden.visible).toBe(false);
    expect(hidden.url).toBe("https://example.test/d/token");
    expect(documentHandoverHidden(hidden)).toEqual(IDLE_DOCUMENT_HANDOVER);
  });

  it("does not drop a handover that was reopened before a late onHidden", () => {
    const reopened = openDocumentHandover({
      url: "https://example.test/d/token",
      documentNumber: "SHZ-РХ-000001",
    });
    expect(documentHandoverHidden(reopened)).toEqual(reopened);
  });
});
