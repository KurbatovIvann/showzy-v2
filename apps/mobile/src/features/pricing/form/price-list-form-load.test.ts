import { describe, expect, it } from "vitest";

import {
  canSubmitPriceListForm,
  classifyPriceListFormLoad,
  combinePriceListFormQueries,
} from "./price-list-form-load";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("classifyPriceListFormLoad", () => {
  it("gates employees before fetching and is ready for create without a query", () => {
    expect(
      classifyPriceListFormLoad({
        mode: "edit",
        canManage: false,
        priceListId: LIST_ID,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyPriceListFormLoad({
        mode: "create",
        canManage: false,
        priceListId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyPriceListFormLoad({
        mode: "create",
        canManage: true,
        priceListId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      canSubmitPriceListForm({ canManage: false, loadKind: "ready" }),
    ).toBe(false);
    expect(
      canSubmitPriceListForm({ canManage: true, loadKind: "permission" }),
    ).toBe(false);
    expect(
      canSubmitPriceListForm({ canManage: true, loadKind: "ready" }),
    ).toBe(true);
  });

  it("maps invalid edit ids to not-found without treating them as ready", () => {
    expect(
      classifyPriceListFormLoad({
        mode: "edit",
        canManage: true,
        priceListId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyPriceListFormLoad({
        mode: "edit",
        canManage: true,
        priceListId: LIST_ID,
        clientReady: true,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyPriceListFormLoad({
        mode: "edit",
        canManage: true,
        priceListId: LIST_ID,
        clientReady: true,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
  });
});

describe("combinePriceListFormQueries", () => {
  it("prefers list not-found, then any error, then pending, then success", () => {
    expect(
      combinePriceListFormQueries([
        { status: "error", failureKind: "not_found" },
        { status: "pending", failureKind: null },
      ]),
    ).toEqual({ status: "error", failureKind: "not_found" });
    expect(
      combinePriceListFormQueries([
        { status: "success", failureKind: null },
        { status: "error", failureKind: "offline" },
      ]),
    ).toEqual({ status: "error", failureKind: "offline" });
    expect(
      combinePriceListFormQueries([
        { status: "success", failureKind: null },
        { status: "pending", failureKind: null },
      ]),
    ).toEqual({ status: "pending", failureKind: null });
    expect(
      combinePriceListFormQueries([
        { status: "success", failureKind: null },
        { status: "success", failureKind: null },
      ]),
    ).toEqual({ status: "success", failureKind: null });
  });
});
