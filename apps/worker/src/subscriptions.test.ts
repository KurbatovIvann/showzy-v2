import { orderCardUpdaterSubscriptions } from "@showzy/chat";
import { pdfRendererSubscriptions } from "@showzy/doc-generation/subscriptions";
import { requestAbandonerSubscriptions } from "@showzy/doc-signing/subscriptions";
import { describe, expect, it } from "vitest";

import { workerSubscriptions } from "./subscriptions.js";

describe("workerSubscriptions", () => {
  it("pairs the same chat, doc-generation, and doc-signing objects the API composition registers", () => {
    expect(workerSubscriptions).toEqual([
      ...orderCardUpdaterSubscriptions,
      ...pdfRendererSubscriptions,
      ...requestAbandonerSubscriptions,
    ]);
    expect(new Set(workerSubscriptions.map((row) => row.consumer))).toEqual(
      new Set([
        "chat.order-card-updater",
        "docGeneration.pdf-renderer",
        "docSigning.request-abandoner",
      ]),
    );
    expect(workerSubscriptions.map((row) => row.event.name).sort()).toEqual([
      "documents.cancelled",
      "documents.created",
      "orders.confirmed",
      "orders.created",
    ]);
  });
});
