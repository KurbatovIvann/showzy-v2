import { describe, expect, it } from "vitest";

import { upsertOrderCard } from "../actions/upsert-order-card.js";
import {
  ORDER_CARD_UPDATER_CONSUMER,
  orderCardUpdaterConfirmed,
  orderCardUpdaterCreated,
  orderCardUpdaterSubscriptions,
} from "./order-card-updater.js";

describe("chat.order-card-updater", () => {
  it("binds both order events to upsertOrderCard under one consumer id", () => {
    expect(orderCardUpdaterCreated.consumer).toBe(ORDER_CARD_UPDATER_CONSUMER);
    expect(orderCardUpdaterConfirmed.consumer).toBe(
      ORDER_CARD_UPDATER_CONSUMER,
    );
    expect(orderCardUpdaterCreated.event.name).toBe("orders.created");
    expect(orderCardUpdaterConfirmed.event.name).toBe("orders.confirmed");
    expect(orderCardUpdaterCreated.contract).toBe(upsertOrderCard.contract);
    expect(orderCardUpdaterConfirmed.contract).toBe(upsertOrderCard.contract);
    expect(orderCardUpdaterSubscriptions).toEqual([
      orderCardUpdaterCreated,
      orderCardUpdaterConfirmed,
    ]);
  });
});
