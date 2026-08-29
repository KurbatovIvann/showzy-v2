import { describe, expect, it } from "vitest";

import type { ConfirmDialogRequest } from "../../../components/ui/confirm-dialog";
import {
  documentHandoverHidden,
  documentOptionsHidden,
  hideDocumentHandover,
  hideDocumentOptions,
  IDLE_DOCUMENT_HANDOVER,
  IDLE_DOCUMENT_OPTIONS,
  openDocumentHandover,
  openDocumentOptions,
  waitThenConfirmDocumentCancel,
  waitThenRunDocumentFollowUp,
} from "./document-options-handshake";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

const CANCEL_CONFIRM: ConfirmDialogRequest = {
  title: "Cancel this document?",
  message: "Really cancel SHZ-РХ-000001?",
  confirmLabel: "Cancel document",
  cancelLabel: "Keep",
  tone: "danger",
};

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("document options chrome", () => {
  it("keeps the selected document while visible becomes false", () => {
    const open = openDocumentOptions(DOCUMENT_ID);
    expect(open).toEqual({ visible: true, documentId: DOCUMENT_ID });
    const hidden = hideDocumentOptions(open);
    expect(hidden.visible).toBe(false);
    expect(hidden.documentId).toBe(DOCUMENT_ID);
  });

  it("clears the selected document on onHidden only after close", () => {
    const closing = hideDocumentOptions(openDocumentOptions(DOCUMENT_ID));
    expect(documentOptionsHidden(closing)).toEqual(IDLE_DOCUMENT_OPTIONS);
  });

  it("does not drop a document that was reopened before a late onHidden", () => {
    const reopened = openDocumentOptions(DOCUMENT_ID);
    expect(documentOptionsHidden(reopened)).toEqual(reopened);
  });
});

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
});

describe("waitThenConfirmDocumentCancel", () => {
  it("presents Alert only after the options sheet is hidden", async () => {
    const hidden = deferred();
    const order: string[] = [];
    const choice = waitThenConfirmDocumentCancel({
      waitHidden: () => {
        order.push("wait");
        return hidden.promise;
      },
      hide: () => {
        order.push("hide");
      },
      presentConfirmDialog: () => {
        order.push("confirm");
        return Promise.resolve("confirm" as const);
      },
      confirm: CANCEL_CONFIRM,
    });
    expect(order).toEqual(["wait", "hide"]);
    hidden.resolve();
    await expect(choice).resolves.toBe("confirm");
    expect(order).toEqual(["wait", "hide", "confirm"]);
  });
});

describe("waitThenRunDocumentFollowUp", () => {
  it("runs share/open-PDF only after the options sheet is hidden", async () => {
    const hidden = deferred();
    const order: string[] = [];
    const done = waitThenRunDocumentFollowUp({
      waitHidden: () => {
        order.push("wait");
        return hidden.promise;
      },
      hide: () => {
        order.push("hide");
      },
      run: () => {
        order.push("run");
      },
    });
    expect(order).toEqual(["wait", "hide"]);
    hidden.resolve();
    await done;
    expect(order).toEqual(["wait", "hide", "run"]);
  });
});
