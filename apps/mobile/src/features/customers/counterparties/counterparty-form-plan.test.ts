import { describe, expect, it } from "vitest";

import {
  emptyCounterpartyFormDraft,
  snapshotFromDraft,
  type CounterpartyFormDraft,
} from "./counterparty-form-draft";
import {
  createCounterpartyPayload,
  parseThenPlanCounterpartyFormSave,
  planCounterpartyFormSave,
  updateCounterpartyPayload,
} from "./counterparty-form-plan";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const SAMPLE_UA_IBAN = "UA000000000000000000000000000";

function validCreateDraft(): CounterpartyFormDraft {
  return {
    ...emptyCounterpartyFormDraft(),
    name: "  ФОП Іваненко  ",
  };
}

describe("createCounterpartyPayload", () => {
  it("sends trimmed name, null optionals, and a null customer link", () => {
    expect(createCounterpartyPayload(validCreateDraft())).toEqual({
      name: "ФОП Іваненко",
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
      customerId: null,
    });
  });

  it("includes requisites and a customer id when set", () => {
    expect(
      createCounterpartyPayload({
        ...validCreateDraft(),
        edrpou: "3312456789",
        iban: `  ${SAMPLE_UA_IBAN}  `,
        customerId: CUSTOMER_ID,
      }),
    ).toMatchObject({
      edrpou: "3312456789",
      iban: SAMPLE_UA_IBAN,
      customerId: CUSTOMER_ID,
    });
  });
});

describe("planCounterpartyFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planCounterpartyFormSave({
      mode: "create",
      counterpartyId: null,
      draft: validCreateDraft(),
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createCounterparty");
    expect(
      planCounterpartyFormSave({
        mode: "create",
        counterpartyId: null,
        draft: validCreateDraft(),
        baseline: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planCounterpartyFormSave({
        mode: "create",
        counterpartyId: null,
        draft: emptyCounterpartyFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("plans update when dirty, unlinks with null customerId, and noops when unchanged", () => {
    const draft = {
      ...validCreateDraft(),
      name: "ФОП Іваненко",
      customerId: CUSTOMER_ID,
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    if (baseline === null) {
      return;
    }
    expect(
      planCounterpartyFormSave({
        mode: "edit",
        counterpartyId: COUNTERPARTY_ID,
        draft,
        baseline,
        lastWrite: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "noop" });

    const unlinked = { ...draft, customerId: null };
    const planned = planCounterpartyFormSave({
      mode: "edit",
      counterpartyId: COUNTERPARTY_ID,
      draft: unlinked,
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write") {
      return;
    }
    expect(planned.write.kind).toBe("updateCounterparty");
    expect(updateCounterpartyPayload(COUNTERPARTY_ID, unlinked)).toMatchObject({
      id: COUNTERPARTY_ID,
      name: "ФОП Іваненко",
      customerId: null,
    });
  });
});

describe("parseThenPlanCounterpartyFormSave", () => {
  it("gates the planner behind a successful UI parse", () => {
    expect(
      parseThenPlanCounterpartyFormSave({
        mode: "create",
        counterpartyId: null,
        draft: emptyCounterpartyFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});
