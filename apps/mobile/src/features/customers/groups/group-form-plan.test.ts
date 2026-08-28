import { describe, expect, it } from "vitest";

import {
  emptyGroupFormDraft,
  snapshotFromDraft,
  type GroupFormDraft,
} from "./group-form-draft";
import {
  createGroupPayload,
  parseThenPlanGroupFormSave,
  planGroupFormSave,
  updateGroupPayload,
} from "./group-form-plan";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

function validCreateDraft(): GroupFormDraft {
  return {
    ...emptyGroupFormDraft(),
    name: "  Опт  ",
  };
}

describe("createGroupPayload", () => {
  it("sends trimmed name, empty description, and null inherit price list", () => {
    expect(createGroupPayload(validCreateDraft())).toEqual({
      name: "Опт",
      description: "",
      priceListId: null,
    });
  });

  it("includes a price-list id when set", () => {
    expect(
      createGroupPayload({
        ...validCreateDraft(),
        priceListId: PRICE_LIST_ID,
        description: "  Для гурту  ",
      }),
    ).toMatchObject({
      priceListId: PRICE_LIST_ID,
      description: "Для гурту",
    });
  });
});

describe("planGroupFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planGroupFormSave({
      mode: "create",
      groupId: null,
      draft: validCreateDraft(),
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createGroup");
    expect(
      planGroupFormSave({
        mode: "create",
        groupId: null,
        draft: validCreateDraft(),
        baseline: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planGroupFormSave({
        mode: "create",
        groupId: null,
        draft: emptyGroupFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("plans update when dirty and noops when unchanged", () => {
    const draft = {
      ...validCreateDraft(),
      name: "Опт",
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    if (baseline === null) {
      return;
    }
    expect(
      planGroupFormSave({
        mode: "edit",
        groupId: GROUP_ID,
        draft,
        baseline,
        lastWrite: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "noop" });

    const renamed = { ...draft, name: "VIP" };
    const planned = planGroupFormSave({
      mode: "edit",
      groupId: GROUP_ID,
      draft: renamed,
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write") {
      return;
    }
    expect(planned.write.kind).toBe("updateGroup");
    expect(updateGroupPayload(GROUP_ID, renamed)).toMatchObject({
      id: GROUP_ID,
      name: "VIP",
    });
  });

  it("clears the price list on update so the group returns to inherit", () => {
    const draft: GroupFormDraft = {
      name: "Опт",
      description: "Для гурту",
      priceListId: PRICE_LIST_ID,
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    const planned = planGroupFormSave({
      mode: "edit",
      groupId: GROUP_ID,
      draft: { ...draft, priceListId: null },
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write" || planned.write.kind !== "updateGroup") {
      return;
    }
    expect(planned.write.input.priceListId).toBeNull();
  });
});

describe("parseThenPlanGroupFormSave", () => {
  it("gates the planner behind a successful UI parse", () => {
    expect(
      parseThenPlanGroupFormSave({
        mode: "create",
        groupId: null,
        draft: emptyGroupFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});
