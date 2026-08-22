import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_FACTS_MAX_IDS,
  getAttachmentFactsContract,
} from "./get-attachment-facts.contract.js";

describe("files.getAttachmentFacts contract", () => {
  it("is a staff internal read with files:view, unaudited, and not an idempotent write", () => {
    expect(getAttachmentFactsContract.name).toBe("files.getAttachmentFacts");
    expect(getAttachmentFactsContract.principal).toBe("staff");
    expect(getAttachmentFactsContract.transport).toBe("internal");
    expect(getAttachmentFactsContract.risk).toBe("read");
    expect(getAttachmentFactsContract.permissions).toEqual(["files:view"]);
    expect(getAttachmentFactsContract.aiExposure).toBe("internal");
    expect(getAttachmentFactsContract.audit).toBe(false);
    expect(getAttachmentFactsContract.idempotent).toBe(false);
    expect(getAttachmentFactsContract.emits).toEqual([]);
    expect(getAttachmentFactsContract.timeout).toBe(5_000);
    expect(ATTACHMENT_FACTS_MAX_IDS).toBe(50);
  });
});
