import { describe, expect, it } from "vitest";

import {
  emptyInvitationFormDraft,
  type InvitationFormDraft,
} from "./invitation-form-draft";
import {
  createInvitePayload,
  parseThenPlanInvitationFormSave,
  planInvitationFormSave,
  secretFromCreateOutput,
} from "./invitation-form-plan";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";
const INVITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function validCreateDraft(): InvitationFormDraft {
  return emptyInvitationFormDraft();
}

describe("createInvitePayload", () => {
  it("omits maxUses on personal and sends null assignments", () => {
    const payload = createInvitePayload(validCreateDraft());
    expect(payload).toMatchObject({
      isReusable: false,
      groupId: null,
      priceListId: null,
      name: null,
      phone: null,
      email: null,
    });
    expect(payload).not.toBeNull();
    if (payload === null) {
      return;
    }
    expect("maxUses" in payload).toBe(false);
  });

  it("sends reusable unlimited as maxUses null and a cap as an integer", () => {
    expect(
      createInvitePayload({
        ...validCreateDraft(),
        kind: "reusable",
        maxUses: "",
      }),
    ).toMatchObject({
      isReusable: true,
      maxUses: null,
    });
    expect(
      createInvitePayload({
        ...validCreateDraft(),
        kind: "reusable",
        maxUses: "5",
        groupId: GROUP_ID,
        priceListId: PRICE_LIST_ID,
        name: "  Марія  ",
      }),
    ).toMatchObject({
      isReusable: true,
      maxUses: 5,
      groupId: GROUP_ID,
      priceListId: PRICE_LIST_ID,
      name: "Марія",
    });
  });
});

describe("planInvitationFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planInvitationFormSave({
      draft: validCreateDraft(),
      created: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createInvite");
    expect(
      planInvitationFormSave({
        draft: validCreateDraft(),
        created: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planInvitationFormSave({
        draft: { ...validCreateDraft(), expiresAt: "nope" },
        created: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("noops once the one-time secret is already shown", () => {
    expect(
      planInvitationFormSave({
        draft: validCreateDraft(),
        created: {
          id: INVITE_ID,
          token: "secret-token",
          url: "showzy:invite/secret-token",
        },
        lastWrite: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "noop" });
  });
});

describe("parseThenPlanInvitationFormSave", () => {
  it("gates the planner behind a successful UI parse", () => {
    expect(
      parseThenPlanInvitationFormSave({
        draft: { ...validCreateDraft(), kind: "reusable", maxUses: "0" },
        created: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});

describe("secretFromCreateOutput", () => {
  it("maps token and url from create output and not from a list row", () => {
    const secret = secretFromCreateOutput({
      id: INVITE_ID,
      isReusable: false,
      maxUses: 1,
      usesCount: 0,
      expiresAt: validCreateDraft().expiresAt,
      status: "pending",
      groupId: null,
      priceListId: null,
      name: null,
      phone: null,
      email: null,
      invitedBy: "user_1",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
      token: "plaintext-once",
      url: "showzy:invite/plaintext-once",
    });
    expect(secret).toEqual({
      id: INVITE_ID,
      token: "plaintext-once",
      url: "showzy:invite/plaintext-once",
    });
    expect(JSON.stringify(secret)).toContain("token");
    expect(JSON.stringify(secret)).toContain("url");
  });
});
