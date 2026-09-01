import { describe, expect, it } from "vitest";

import {
  staffAssistantWorkingSetAddendum,
  STAFF_ASSISTANT_WORKING_SET_IDS_MAX,
} from "./working-set.js";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("staffAssistantWorkingSetAddendum", () => {
  it("omits the addendum when there are no success ids", () => {
    expect(staffAssistantWorkingSetAddendum([])).toBeUndefined();
    expect(
      staffAssistantWorkingSetAddendum([
        {
          actionName: "catalog.listProducts",
          resultIds: [],
          outcome: "success",
        },
        {
          actionName: "customers.deleteCustomer",
          resultIds: [productId],
          outcome: "confirmation_required",
        },
      ]),
    ).toBeUndefined();
  });

  it("groups success ids by action name and tells the model not to re-list", () => {
    const addendum = staffAssistantWorkingSetAddendum([
      {
        actionName: "catalog.listProducts",
        resultIds: [productId, otherId],
        outcome: "success",
      },
    ]);
    expect(addendum).toContain("catalog.listProducts");
    expect(addendum).toContain(productId);
    expect(addendum).toContain(otherId);
    expect(addendum).toContain(
      "Do not call a list tool solely to recover these ids",
    );
    expect(addendum).toContain("not a list of what you can do");
    expect(addendum).not.toContain("confirmed");
  });

  it("prefers newest ids when the cap is exceeded", () => {
    const oldest = "11111111-1111-4111-8111-111111111111";
    const newest = "99999999-9999-4999-8999-999999999999";
    const runs = Array.from(
      { length: STAFF_ASSISTANT_WORKING_SET_IDS_MAX },
      (_, index) => ({
        actionName: "catalog.listProducts",
        resultIds: [
          index === 0
            ? oldest
            : index === STAFF_ASSISTANT_WORKING_SET_IDS_MAX - 1
              ? newest
              : rowId(index),
          rowId(index + 100),
        ],
        outcome: "success" as const,
      }),
    );
    const addendum = staffAssistantWorkingSetAddendum(runs);
    expect(addendum).toContain(newest);
    expect(addendum).not.toContain(oldest);
  });
});

function rowId(index: number): string {
  return `33333333-3333-4333-8333-${index.toString(16).padStart(12, "0")}`;
}
