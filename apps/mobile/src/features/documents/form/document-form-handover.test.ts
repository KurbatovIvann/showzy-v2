import { describe, expect, it } from "vitest";

import {
  shouldReplaceToListAfterHandoverClose,
  waitThenReplaceAfterCreateHandover,
} from "./document-form-handover";

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

describe("shouldReplaceToListAfterHandoverClose", () => {
  it("replaces after create and ignores sheet visible", () => {
    expect(shouldReplaceToListAfterHandoverClose({ created: true })).toBe(true);
    expect(shouldReplaceToListAfterHandoverClose({ created: false })).toBe(
      false,
    );
  });
});

describe("waitThenReplaceAfterCreateHandover", () => {
  it("replaces only after the sheet hide timeout race when created", async () => {
    const hidden = deferred();
    const order: string[] = [];
    const done = waitThenReplaceAfterCreateHandover({
      created: true,
      waitHidden: () => {
        order.push("wait");
        return hidden.promise;
      },
      hide: () => {
        order.push("hide");
      },
      replace: () => {
        order.push("replace");
      },
    });
    expect(order).toEqual(["wait", "hide"]);
    hidden.resolve();
    await done;
    expect(order).toEqual(["wait", "hide", "replace"]);
  });

  it("hides without replacing when the editor was not created", async () => {
    const order: string[] = [];
    await waitThenReplaceAfterCreateHandover({
      created: false,
      waitHidden: () => {
        order.push("wait");
        return Promise.resolve();
      },
      hide: () => {
        order.push("hide");
      },
      replace: () => {
        order.push("replace");
      },
    });
    expect(order).toEqual(["hide"]);
  });
});
