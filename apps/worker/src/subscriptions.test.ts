import { orderCardUpdaterSubscriptions } from "@showzy/chat";
import { describe, expect, it } from "vitest";

import { workerSubscriptions } from "./subscriptions.js";

describe("workerSubscriptions", () => {
  it("pairs the same chat.order-card-updater objects the API composition registers", () => {
    expect(workerSubscriptions).toEqual([...orderCardUpdaterSubscriptions]);
    expect(new Set(workerSubscriptions.map((row) => row.consumer))).toEqual(
      new Set(["chat.order-card-updater"]),
    );
    expect(workerSubscriptions.map((row) => row.event.name).sort()).toEqual([
      "orders.confirmed",
      "orders.created",
    ]);
  });
});
