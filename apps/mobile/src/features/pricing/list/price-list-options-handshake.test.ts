import { describe, expect, it, vi } from "vitest";

import {
  hidePriceListOptions,
  IDLE_PRICE_LIST_OPTIONS,
  openPriceListOptions,
  optionsFollowUpWaitsForHidden,
  planPriceListOptionsFollowUp,
  priceListOptionsHidden,
  runAfterOptionsSheetHidden,
} from "./price-list-options-handshake";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("price-list options chrome", () => {
  it("keeps the selected list while visible becomes false", () => {
    const open = openPriceListOptions(LIST_ID);
    expect(open).toEqual({ visible: true, listId: LIST_ID });
    const hidden = hidePriceListOptions(open);
    expect(hidden.visible).toBe(false);
    expect(hidden.listId).toBe(LIST_ID);
  });

  it("clears the selected list on onHidden only after close", () => {
    const closing = hidePriceListOptions(openPriceListOptions(LIST_ID));
    expect(priceListOptionsHidden(closing)).toEqual(IDLE_PRICE_LIST_OPTIONS);
  });

  it("does not drop a list that was reopened before a late onHidden", () => {
    const reopened = openPriceListOptions(LIST_ID);
    expect(priceListOptionsHidden(reopened)).toEqual(reopened);
  });
});

describe("planPriceListOptionsFollowUp", () => {
  it("waits for delete and deactivate-default, not for other writes", () => {
    expect(
      planPriceListOptionsFollowUp({
        action: "delete",
        isDefault: false,
        isActive: true,
      }),
    ).toEqual({ kind: "delete" });
    expect(
      planPriceListOptionsFollowUp({
        action: "toggleActive",
        isDefault: true,
        isActive: true,
      }),
    ).toEqual({ kind: "blockDeactivateDefault" });
    expect(
      planPriceListOptionsFollowUp({
        action: "toggleActive",
        isDefault: false,
        isActive: true,
      }),
    ).toEqual({ kind: "toggleActive" });
    expect(
      planPriceListOptionsFollowUp({
        action: "setDefault",
        isDefault: false,
        isActive: true,
      }),
    ).toEqual({ kind: "setDefault" });
    expect(optionsFollowUpWaitsForHidden({ kind: "delete" })).toBe(true);
    expect(
      optionsFollowUpWaitsForHidden({ kind: "blockDeactivateDefault" }),
    ).toBe(true);
    expect(optionsFollowUpWaitsForHidden({ kind: "toggleActive" })).toBe(false);
    expect(optionsFollowUpWaitsForHidden({ kind: "setDefault" })).toBe(false);
  });
});

describe("runAfterOptionsSheetHidden", () => {
  it("delete waits for sheet hidden before presentConfirmDialog", async () => {
    let chrome = openPriceListOptions(LIST_ID);
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const presentConfirmDialog = vi.fn(async () => {
      events.push("presentConfirmDialog");
      return "cancel" as const;
    });

    const done = runAfterOptionsSheetHidden({
      waitHidden: () => {
        events.push("wait");
        return gate;
      },
      hide: () => {
        chrome = hidePriceListOptions(chrome);
        events.push("hide");
      },
      then: async () => {
        await presentConfirmDialog();
      },
    });

    await Promise.resolve();
    expect(events).toEqual(["wait", "hide"]);
    expect(chrome.visible).toBe(false);
    expect(chrome.listId).toBe(LIST_ID);
    expect(presentConfirmDialog).not.toHaveBeenCalled();

    release();
    await done;
    expect(presentConfirmDialog).toHaveBeenCalledOnce();
    expect(events).toEqual(["wait", "hide", "presentConfirmDialog"]);
  });

  it("deactivate-default does not show the Banner under an open Modal", async () => {
    const followUp = planPriceListOptionsFollowUp({
      action: "toggleActive",
      isDefault: true,
      isActive: true,
    });
    expect(followUp.kind).toBe("blockDeactivateDefault");
    expect(optionsFollowUpWaitsForHidden(followUp)).toBe(true);

    let chrome = openPriceListOptions(LIST_ID);
    let banner: string | null = null;
    const submitDeactivate = vi.fn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const done = runAfterOptionsSheetHidden({
      waitHidden: () => gate,
      hide: () => {
        chrome = hidePriceListOptions(chrome);
      },
      then: () => {
        banner = "cannot-deactivate-default";
      },
    });

    await Promise.resolve();
    expect(chrome.visible).toBe(false);
    expect(banner).toBeNull();
    expect(submitDeactivate).not.toHaveBeenCalled();

    release();
    await done;
    expect(chrome.visible).toBe(false);
    expect(banner).toBe("cannot-deactivate-default");
    expect(submitDeactivate).not.toHaveBeenCalled();
  });
});
