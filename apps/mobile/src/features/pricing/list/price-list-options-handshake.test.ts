import { describe, expect, it, vi } from "vitest";

import type { ConfirmDialogRequest } from "../../../components/ui/confirm-dialog";
import {
  hidePriceListOptions,
  IDLE_PRICE_LIST_OPTIONS,
  openPriceListOptions,
  optionsFollowUpWaitsForHidden,
  planPriceListOptionsFollowUp,
  priceListOptionsHidden,
  runPriceListOptionsFollowUp,
} from "./price-list-options-handshake";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

const DELETE_CONFIRM: ConfirmDialogRequest = {
  title: "Delete this price list?",
  message: "Really delete Опт?",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
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

describe("runPriceListOptionsFollowUp", () => {
  it("delete waits for sheet hidden before presentConfirmDialog", async () => {
    let chrome = openPriceListOptions(LIST_ID);
    const events: string[] = [];
    const gate = deferred();
    const presentConfirmDialog = vi.fn(() => {
      events.push("presentConfirmDialog");
      return Promise.resolve("confirm" as const);
    });

    const done = runPriceListOptionsFollowUp({
      kind: "delete",
      waitHidden: () => {
        events.push("wait");
        return gate.promise;
      },
      hide: () => {
        chrome = hidePriceListOptions(chrome);
        events.push("hide");
      },
      presentConfirmDialog,
      confirm: DELETE_CONFIRM,
    });

    await Promise.resolve();
    expect(events).toEqual(["wait", "hide"]);
    expect(chrome.visible).toBe(false);
    expect(chrome.listId).toBe(LIST_ID);
    expect(presentConfirmDialog).not.toHaveBeenCalled();

    gate.resolve();
    await expect(done).resolves.toBe("confirm");
    expect(presentConfirmDialog).toHaveBeenCalledOnce();
    expect(presentConfirmDialog).toHaveBeenCalledWith(DELETE_CONFIRM);
    expect(events).toEqual(["wait", "hide", "presentConfirmDialog"]);
  });

  it("delete returns cancel without implying a submit", async () => {
    const gate = deferred();
    const presentConfirmDialog = vi.fn(() =>
      Promise.resolve("cancel" as const),
    );

    const done = runPriceListOptionsFollowUp({
      kind: "delete",
      waitHidden: () => gate.promise,
      hide: () => undefined,
      presentConfirmDialog,
      confirm: DELETE_CONFIRM,
    });

    expect(presentConfirmDialog).not.toHaveBeenCalled();
    gate.resolve();
    await expect(done).resolves.toBe("cancel");
    expect(presentConfirmDialog).toHaveBeenCalledOnce();
  });

  it("deactivate-default sets Banner only after hide and never submits", async () => {
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
    const gate = deferred();

    const done = runPriceListOptionsFollowUp({
      kind: "blockDeactivateDefault",
      waitHidden: () => gate.promise,
      hide: () => {
        chrome = hidePriceListOptions(chrome);
      },
      setBanner: (message) => {
        banner = message;
      },
      submitDeactivate,
      message: "cannot-deactivate-default",
    });

    await Promise.resolve();
    expect(chrome.visible).toBe(false);
    expect(banner).toBeNull();
    expect(submitDeactivate).not.toHaveBeenCalled();

    gate.resolve();
    await done;
    expect(chrome.visible).toBe(false);
    expect(banner).toBe("cannot-deactivate-default");
    expect(submitDeactivate).not.toHaveBeenCalled();
  });
});
