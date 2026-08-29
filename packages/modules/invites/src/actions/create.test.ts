import { describe, expect, it } from "vitest";

import {
  createInviteContract,
  createInviteInputSchema,
  EXPIRES_AT_RANGE_MESSAGE,
  inviteCopyUrl,
  INVITE_COPY_URL_PREFIX,
  PERSONAL_MAX_USES_MESSAGE,
} from "./create.contract.js";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_PHONE_MAX,
  INVITE_EXPIRES_MAX_MS,
  INVITE_EXPIRES_MIN_MS,
  inviteViewSchema,
} from "./invite-view.contract.js";

const HOUR_MS = 60 * 60 * 1000;

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("invites.create contract", () => {
  it("is an idempotent audited staff client write with customers:invite and invites.created", () => {
    expect(createInviteContract.name).toBe("invites.create");
    expect(createInviteContract.principal).toBe("staff");
    expect(createInviteContract.transport).toBe("client");
    expect(createInviteContract.risk).toBe("write");
    expect(createInviteContract.permissions).toEqual(["customers:invite"]);
    expect(createInviteContract.aiExposure).toBe("exposed");
    expect(createInviteContract.requiresConfirmation).toBe(false);
    expect(createInviteContract.idempotent).toBe(true);
    expect(createInviteContract.audit).toBe(true);
    expect(createInviteContract.emits).toEqual(["invites.created"]);
    expect(createInviteContract.atomicCalls).toEqual([]);
    expect(createInviteContract.atomicCallers).toEqual([]);
    expect(createInviteContract.timeout).toBe(10_000);
    expect(createInviteContract.rateLimit).toBeUndefined();
    expect(CUSTOMER_NAME_MAX).toBe(120);
    expect(CUSTOMER_PHONE_MAX).toBe(30);
    expect(CUSTOMER_EMAIL_MAX).toBe(200);
    expect(INVITE_EXPIRES_MIN_MS).toBe(HOUR_MS);
    expect(INVITE_EXPIRES_MAX_MS).toBe(365 * 24 * HOUR_MS);
    expect(Object.keys(inviteViewSchema.shape).toSorted()).toEqual([
      "createdAt",
      "email",
      "expiresAt",
      "groupId",
      "id",
      "invitedBy",
      "isReusable",
      "maxUses",
      "name",
      "phone",
      "priceListId",
      "status",
      "updatedAt",
      "usesCount",
    ]);
  });

  it("accepts personal without maxUses and reusable unlimited or capped", () => {
    const expiresAt = isoFromNow(7 * 24 * HOUR_MS);
    expect(
      createInviteInputSchema.parse({ isReusable: false, expiresAt }),
    ).toMatchObject({ isReusable: false, expiresAt });
    expect(
      createInviteInputSchema.parse({
        isReusable: false,
        expiresAt,
        maxUses: 1,
      }).maxUses,
    ).toBe(1);
    expect(
      createInviteInputSchema.parse({ isReusable: true, expiresAt }).maxUses,
    ).toBeUndefined();
    expect(
      createInviteInputSchema.parse({
        isReusable: true,
        expiresAt,
        maxUses: null,
      }).maxUses,
    ).toBeNull();
    expect(
      createInviteInputSchema.parse({
        isReusable: true,
        expiresAt,
        maxUses: 10,
      }).maxUses,
    ).toBe(10);
  });

  it("rejects expiry out of range, personal maxUses other than 1, extras, and over-max identity", () => {
    const expiresAt = isoFromNow(7 * 24 * HOUR_MS);
    const tooSoon = createInviteInputSchema.safeParse({
      isReusable: true,
      expiresAt: isoFromNow(30 * 60 * 1000),
    });
    expect(tooSoon.success).toBe(false);
    if (!tooSoon.success) {
      expect(
        tooSoon.error.issues.some(
          (issue) => issue.message === EXPIRES_AT_RANGE_MESSAGE,
        ),
      ).toBe(true);
    }
    const tooLate = createInviteInputSchema.safeParse({
      isReusable: true,
      expiresAt: isoFromNow(400 * 24 * HOUR_MS),
    });
    expect(tooLate.success).toBe(false);

    const personalCapped = createInviteInputSchema.safeParse({
      isReusable: false,
      expiresAt,
      maxUses: 2,
    });
    expect(personalCapped.success).toBe(false);
    if (!personalCapped.success) {
      expect(
        personalCapped.error.issues.some(
          (issue) => issue.message === PERSONAL_MAX_USES_MESSAGE,
        ),
      ).toBe(true);
    }
    expect(
      createInviteInputSchema.safeParse({
        isReusable: false,
        expiresAt,
        maxUses: null,
      }).success,
    ).toBe(false);

    expect(
      createInviteInputSchema.safeParse({
        isReusable: false,
        expiresAt,
        companyId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
    expect(
      createInviteInputSchema.safeParse({
        isReusable: false,
        expiresAt,
        name: "n".repeat(CUSTOMER_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createInviteInputSchema.safeParse({
        isReusable: false,
        expiresAt,
        phone: "1".repeat(CUSTOMER_PHONE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createInviteInputSchema.safeParse({
        isReusable: false,
        expiresAt,
        email: `${"a".repeat(CUSTOMER_EMAIL_MAX)}@x.co`,
      }).success,
    ).toBe(false);
  });

  it("builds an opaque copy URL that embeds the plaintext token", () => {
    const plaintextToken = "invite-copy-sample";
    expect(inviteCopyUrl(plaintextToken)).toBe(
      `${INVITE_COPY_URL_PREFIX}${plaintextToken}`,
    );
    expect(inviteCopyUrl(plaintextToken).startsWith("https://")).toBe(false);
  });
});
