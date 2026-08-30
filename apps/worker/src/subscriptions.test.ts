import { orderCardUpdaterSubscriptions } from "@showzy/chat";
import { pdfRendererSubscriptions } from "@showzy/doc-generation/subscriptions";
import { describe, expect, it } from "vitest";

import { workerSubscriptions } from "./subscriptions.js";

describe("workerSubscriptions", () => {
  it("pairs the same chat and doc-generation objects the API composition registers", () => {
    expect(workerSubscriptions).toEqual([
      ...orderCardUpdaterSubscriptions,
      ...pdfRendererSubscriptions,
    ]);
    expect(new Set(workerSubscriptions.map((row) => row.consumer))).toEqual(
      new Set(["chat.order-card-updater", "docGeneration.pdf-renderer"]),
    );
    expect(workerSubscriptions.map((row) => row.event.name).sort()).toEqual([
      "documents.created",
      "orders.confirmed",
      "orders.created",
    ]);
  });
});
