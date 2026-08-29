import { describe, expect, it } from "vitest";

import {
  applyInviteExpiresDate,
  defaultInviteExpiresAt,
  emptyInvitationFormDraft,
  isInvitationFormDirty,
  parseInvitationFormUiDraft,
  snapshotFromDraft,
  type InvitationFormDraft,
} from "./invitation-form-draft";
import {
  expiresAtInRange,
  INVITE_EXPIRES_DEFAULT_MS,
  INVITE_EXPIRES_MAX_MS,
  INVITE_EXPIRES_MIN_MS,
} from "./invitation-form.schema";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-08-29T10:00:00.000Z");

function validCreateDraft(): InvitationFormDraft {
  return emptyInvitationFormDraft(NOW);
}

describe("emptyInvitationFormDraft / defaultInviteExpiresAt", () => {
  it("defaults to personal, empty assignments, and now+7d", () => {
    expect(validCreateDraft()).toEqual({
      kind: "personal",
      name: "",
      phone: "",
      email: "",
      groupId: null,
      priceListId: null,
      maxUses: "",
      expiresAt: new Date(NOW + INVITE_EXPIRES_DEFAULT_MS).toISOString(),
    });
    expect(defaultInviteExpiresAt(NOW)).toBe(
      new Date(NOW + INVITE_EXPIRES_DEFAULT_MS).toISOString(),
    );
  });
});

describe("applyInviteExpiresDate", () => {
  it("keeps the draft clock time on the picked local calendar date", () => {
    const iso = "2026-09-05T10:00:00.000Z";
    const current = new Date(iso);
    const picked = new Date(2026, 8, 10);
    const next = new Date(applyInviteExpiresDate(iso, picked, NOW));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(10);
    expect(next.getHours()).toBe(current.getHours());
    expect(next.getMinutes()).toBe(current.getMinutes());
  });

  it("reclamps the min picker day when the draft clock falls below now+1h", () => {
    const nowLocal = new Date(NOW);
    const iso = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate() + 7,
      nowLocal.getHours(),
      nowLocal.getMinutes(),
      nowLocal.getSeconds(),
      nowLocal.getMilliseconds(),
    ).toISOString();
    const minMs = NOW + INVITE_EXPIRES_MIN_MS;
    const minBound = new Date(minMs);
    const picked = new Date(
      minBound.getFullYear(),
      minBound.getMonth(),
      minBound.getDate(),
    );
    const unclamped = new Date(picked.getTime());
    unclamped.setHours(
      nowLocal.getHours(),
      nowLocal.getMinutes(),
      nowLocal.getSeconds(),
      nowLocal.getMilliseconds(),
    );
    expect(unclamped.getTime()).toBeLessThan(minMs);
    const nextIso = applyInviteExpiresDate(iso, picked, NOW);
    expect(Date.parse(nextIso)).toBe(minMs);
    expect(expiresAtInRange(nextIso, NOW)).toBe(true);
  });

  it("reclamps the max picker day when the draft clock exceeds now+365d", () => {
    const nowLocal = new Date(NOW);
    const lateIso = new Date(
      nowLocal.getFullYear(),
      nowLocal.getMonth(),
      nowLocal.getDate() + 7,
      23,
      59,
      59,
      999,
    ).toISOString();
    const maxMs = NOW + INVITE_EXPIRES_MAX_MS;
    const maxBound = new Date(maxMs);
    const picked = new Date(
      maxBound.getFullYear(),
      maxBound.getMonth(),
      maxBound.getDate(),
    );
    const late = new Date(lateIso);
    const unclamped = new Date(picked.getTime());
    unclamped.setHours(
      late.getHours(),
      late.getMinutes(),
      late.getSeconds(),
      late.getMilliseconds(),
    );
    expect(unclamped.getTime()).toBeGreaterThan(maxMs);
    const nextIso = applyInviteExpiresDate(lateIso, picked, NOW);
    expect(Date.parse(nextIso)).toBe(maxMs);
    expect(expiresAtInRange(nextIso, NOW)).toBe(true);
  });
});

describe("isInvitationFormDirty", () => {
  it("is clean against the origin and dirty after kind or assignment change", () => {
    const origin = validCreateDraft();
    expect(isInvitationFormDirty(origin, origin)).toBe(false);
    expect(isInvitationFormDirty({ ...origin, kind: "reusable" }, origin)).toBe(
      true,
    );
    expect(
      isInvitationFormDirty({ ...origin, groupId: GROUP_ID }, origin),
    ).toBe(true);
  });
});

describe("snapshotFromDraft", () => {
  it("turns blank identity and assignments into inherit-null", () => {
    expect(snapshotFromDraft(validCreateDraft())).toEqual({
      isReusable: false,
      expiresAt: validCreateDraft().expiresAt,
      maxUses: null,
      groupId: null,
      priceListId: null,
      name: null,
      phone: null,
      email: null,
    });
    expect(
      snapshotFromDraft({
        ...validCreateDraft(),
        kind: "reusable",
        maxUses: "4",
        groupId: GROUP_ID,
        priceListId: PRICE_LIST_ID,
        name: "  Марія  ",
      }),
    ).toMatchObject({
      isReusable: true,
      maxUses: 4,
      groupId: GROUP_ID,
      priceListId: PRICE_LIST_ID,
      name: "Марія",
    });
    expect(parseInvitationFormUiDraft(validCreateDraft()).ok).toBe(true);
  });
});
