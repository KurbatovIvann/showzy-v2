import { describe, expect, it } from "vitest";

import {
  emptyCustomerFormDraft,
  snapshotFromDraft,
  type CustomerFormDraft,
} from "./customer-form-draft";
import {
  createCustomerPayload,
  parseThenPlanCustomerFormSave,
  planCustomerFormSave,
  updateCustomerPayload,
} from "./customer-form-plan";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

function validCreateDraft(): CustomerFormDraft {
  return {
    ...emptyCustomerFormDraft(),
    name: "  Марія  ",
    phone: "+38067",
  };
}

describe("createCustomerPayload", () => {
  it("sends trimmed name, null inherit assignments, and omits userId", () => {
    expect(createCustomerPayload(validCreateDraft())).toEqual({
      name: "Марія",
      phone: "+38067",
      email: null,
      notes: null,
      groupId: null,
      priceListId: null,
    });
  });

  it("includes group and price-list ids when set", () => {
    expect(
      createCustomerPayload({
        ...validCreateDraft(),
        groupId: GROUP_ID,
        priceListId: PRICE_LIST_ID,
      }),
    ).toMatchObject({
      groupId: GROUP_ID,
      priceListId: PRICE_LIST_ID,
    });
  });
});

describe("planCustomerFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planCustomerFormSave({
      mode: "create",
      customerId: null,
      draft: validCreateDraft(),
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createCustomer");
    expect(
      planCustomerFormSave({
        mode: "create",
        customerId: null,
        draft: validCreateDraft(),
        baseline: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planCustomerFormSave({
        mode: "create",
        customerId: null,
        draft: emptyCustomerFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("plans update when dirty and noops when unchanged", () => {
    const draft = {
      ...validCreateDraft(),
      name: "Марія",
      phone: "+38067",
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    if (baseline === null) {
      return;
    }
    expect(
      planCustomerFormSave({
        mode: "edit",
        customerId: CUSTOMER_ID,
        draft,
        baseline,
        lastWrite: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "noop" });

    const renamed = { ...draft, name: "Олена" };
    const planned = planCustomerFormSave({
      mode: "edit",
      customerId: CUSTOMER_ID,
      draft: renamed,
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write") {
      return;
    }
    expect(planned.write.kind).toBe("updateCustomer");
    expect(updateCustomerPayload(CUSTOMER_ID, renamed)).toMatchObject({
      id: CUSTOMER_ID,
      name: "Олена",
      userId: null,
    });
  });

  it("keeps userId on update so a userId-only row stays valid", () => {
    const draft: CustomerFormDraft = {
      ...emptyCustomerFormDraft(),
      name: "Марія",
      userId: "user_invite",
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    const planned = planCustomerFormSave({
      mode: "edit",
      customerId: CUSTOMER_ID,
      draft: { ...draft, notes: "note" },
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write" || planned.write.kind !== "updateCustomer") {
      return;
    }
    expect(planned.write.input.userId).toBe("user_invite");
  });
});

describe("parseThenPlanCustomerFormSave", () => {
  it("gates the planner behind a successful UI parse", () => {
    expect(
      parseThenPlanCustomerFormSave({
        mode: "create",
        customerId: null,
        draft: emptyCustomerFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});
