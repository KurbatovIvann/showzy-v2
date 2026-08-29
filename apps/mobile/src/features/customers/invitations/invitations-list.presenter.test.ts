import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import type { InviteListItem } from "../api/invite.queries";
import {
  classifyInvitationsList,
  formatInviteExpiry,
  inviteExpiryLabel,
  inviteRowActions,
  inviteRowTitle,
  inviteStatusLabel,
  inviteStatusTone,
  inviteUsesLabel,
  nameById,
  toInviteRowView,
} from "./invitations-list.presenter";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

function invite(overrides: Partial<InviteListItem> = {}): InviteListItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    isReusable: false,
    maxUses: 1,
    usesCount: 0,
    expiresAt: "2026-09-05T12:00:00.000Z",
    status: "pending",
    groupId: GROUP_ID,
    priceListId: PRICE_LIST_ID,
    name: "Марія",
    phone: "+380501112233",
    email: "maria@example.com",
    invitedBy: "user_1",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

const untitled = {
  reusable: "Reusable invite",
  personal: "Invitation",
};

describe("toInviteRowView", () => {
  it("maps status and group/price-list names from lookup maps", () => {
    const view = toInviteRowView(
      invite(),
      nameById([{ id: GROUP_ID, name: "VIP" }]),
      nameById([{ id: PRICE_LIST_ID, name: "Опт" }]),
      untitled,
    );
    expect(view).toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Марія",
      status: "pending",
      groupName: "VIP",
      priceListName: "Опт",
      phone: "+380501112233",
      email: "maria@example.com",
      usesCount: 0,
      maxUses: 1,
      expiresAt: "2026-09-05T12:00:00.000Z",
    });
    expect("token" in view).toBe(false);
  });

  it("falls back to phone, email, then untitled copy when name is empty", () => {
    expect(
      inviteRowTitle(
        invite({ name: null, phone: "+38050", email: null }),
        untitled,
      ),
    ).toBe("+38050");
    expect(
      inviteRowTitle(
        invite({ name: null, phone: null, email: "a@b.c" }),
        untitled,
      ),
    ).toBe("a@b.c");
    expect(
      inviteRowTitle(
        invite({
          name: null,
          phone: null,
          email: null,
          isReusable: true,
        }),
        untitled,
      ),
    ).toBe("Reusable invite");
    expect(
      inviteRowTitle(
        invite({
          name: null,
          phone: null,
          email: null,
          isReusable: false,
        }),
        untitled,
      ),
    ).toBe("Invitation");
  });

  it("omits contact meta when it is already the title", () => {
    const view = toInviteRowView(
      invite({ name: null, phone: "+38050", email: null }),
      nameById([]),
      nameById([]),
      untitled,
    );
    expect(view.title).toBe("+38050");
    expect(view.phone).toBeNull();
  });
});

describe("invite labels", () => {
  const copy = customersCopy("en");

  it("uses canvas-aligned status labels and tones", () => {
    expect(inviteStatusLabel("pending", copy.inviteStatus)).toBe("Active");
    expect(inviteStatusLabel("revoked", copy.inviteStatus)).toBe("Revoked");
    expect(inviteStatusLabel("expired", copy.inviteStatus)).toBe("Expired");
    expect(inviteStatusLabel("exhausted", copy.inviteStatus)).toBe("Exhausted");
    expect(inviteStatusTone("pending")).toBe("success");
    expect(inviteStatusTone("revoked")).toBe("neutral");
    expect(inviteStatusTone("expired")).toBe("attention");
    expect(inviteStatusTone("exhausted")).toBe("attention");
  });

  it("formats uses and expiry without exposing a token", () => {
    expect(
      inviteUsesLabel(2, 5, {
        limited: copy.inviteUses,
        unlimited: copy.inviteUsesUnlimited,
      }),
    ).toBe("Used 2 of 5");
    expect(
      inviteUsesLabel(3, null, {
        limited: copy.inviteUses,
        unlimited: copy.inviteUsesUnlimited,
      }),
    ).toBe("Used 3 (unlimited)");
    expect(formatInviteExpiry("2026-09-05T12:00:00.000Z", "en")).toMatch(
      /2026/,
    );
    expect(
      inviteExpiryLabel("2026-09-05T12:00:00.000Z", "pending", "en", {
        pending: copy.inviteExpires,
        ended: copy.inviteExpired,
      }),
    ).toContain("Valid until");
    expect(
      inviteExpiryLabel("2026-09-05T12:00:00.000Z", "expired", "en", {
        pending: copy.inviteExpires,
        ended: copy.inviteExpired,
      }),
    ).toContain("Ended");
  });
});

describe("classifyInvitationsList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
  };

  it("splits loading, offline, error, empty, and rows", () => {
    expect(classifyInvitationsList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
    expect(
      classifyInvitationsList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyInvitationsList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
    expect(classifyInvitationsList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
    expect(classifyInvitationsList(base)).toEqual({ kind: "empty-catalog" });
    expect(classifyInvitationsList({ ...base, rowCount: 2 })).toEqual({
      kind: "rows",
    });
  });
});

describe("inviteRowActions", () => {
  it("hides revoke without invite permission and on non-pending rows", () => {
    expect(inviteRowActions({ status: "pending", canInvite: false })).toEqual({
      showRevoke: false,
    });
    expect(inviteRowActions({ status: "revoked", canInvite: true })).toEqual({
      showRevoke: false,
    });
    expect(inviteRowActions({ status: "expired", canInvite: true })).toEqual({
      showRevoke: false,
    });
    expect(inviteRowActions({ status: "exhausted", canInvite: true })).toEqual({
      showRevoke: false,
    });
    expect(inviteRowActions({ status: "pending", canInvite: true })).toEqual({
      showRevoke: true,
    });
  });
});
