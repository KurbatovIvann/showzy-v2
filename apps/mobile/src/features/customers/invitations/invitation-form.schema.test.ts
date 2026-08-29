import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  emptyInvitationFormDraft,
  parseInvitationFormUiDraft,
  validateInvitationForm,
} from "./invitation-form-draft";
import { resolveInvitationFormCopy } from "./invitation-form-copy";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_PHONE_MAX,
  INVITE_EXPIRES_MAX_MS,
  INVITE_EXPIRES_MIN_MS,
  expiresAtInRange,
  fieldErrorsFromDraftSchema,
  invitationFormDraftSchema,
  invitationFormResolver,
  parseInviteMaxUsesInput,
} from "./invitation-form.schema";

const copy = customersCopy("uk").inviteForm;
const HOUR_MS = 60 * 60 * 1000;

function validDraft() {
  return emptyInvitationFormDraft();
}

describe("invitationFormDraftSchema", () => {
  it("accepts empty identity and empty assignments on a personal invite", () => {
    const draft = validDraft();
    const parsed = invitationFormDraftSchema.safeParse(draft);
    expect(parsed.success).toBe(true);
    expect(validateInvitationForm(draft)).toEqual({
      name: null,
      phone: null,
      email: null,
      expiresAt: null,
      maxUses: null,
    });
    expect(draft.groupId).toBeNull();
    expect(draft.priceListId).toBeNull();
    expect(draft.kind).toBe("personal");
  });

  it("rejects over-max optional identity", () => {
    const parsed = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      name: "n".repeat(CUSTOMER_NAME_MAX + 1),
      phone: "p".repeat(CUSTOMER_PHONE_MAX + 1),
      email: "e".repeat(CUSTOMER_EMAIL_MAX + 1),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("too_long");
    expect(errors.phone).toBe("too_long");
    expect(errors.email).toBe("too_long");
  });

  it("rejects expiresAt outside now+1h .. now+365d", () => {
    const now = Date.now();
    const tooSoon = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      expiresAt: new Date(now + INVITE_EXPIRES_MIN_MS - 60_000).toISOString(),
    });
    expect(tooSoon.success).toBe(false);
    if (!tooSoon.success) {
      expect(fieldErrorsFromDraftSchema(tooSoon.error).expiresAt).toBe("range");
    }
    const tooFar = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      expiresAt: new Date(now + INVITE_EXPIRES_MAX_MS + HOUR_MS).toISOString(),
    });
    expect(tooFar.success).toBe(false);
    if (!tooFar.success) {
      expect(fieldErrorsFromDraftSchema(tooFar.error).expiresAt).toBe("range");
    }
    expect(expiresAtInRange(validDraft().expiresAt, now)).toBe(true);
  });

  it("rejects a reusable cap that is not an integer >= 1 and ignores it on personal", () => {
    const reusableBad = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      kind: "reusable",
      maxUses: "0",
    });
    expect(reusableBad.success).toBe(false);
    if (!reusableBad.success) {
      expect(fieldErrorsFromDraftSchema(reusableBad.error).maxUses).toBe(
        "invalid",
      );
    }
    const reusableText = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      kind: "reusable",
      maxUses: "abc",
    });
    expect(reusableText.success).toBe(false);
    const personalLeftover = invitationFormDraftSchema.safeParse({
      ...validDraft(),
      kind: "personal",
      maxUses: "2",
    });
    expect(personalLeftover.success).toBe(true);
    expect(parseInviteMaxUsesInput("")).toBeNull();
    expect(parseInviteMaxUsesInput("3")).toBe(3);
  });
});

describe("invitationFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await invitationFormResolver(
      {
        ...validDraft(),
        expiresAt: "not-a-date",
      },
      undefined,
      {
        fields: {},
        shouldUseNativeValidation: false,
      },
    );
    const expiresKey = result.errors.expiresAt?.message;
    expect(expiresKey).toBe("invalid");
    expect(expiresKey).not.toBe(copy.errors.expiresInvalid);
    if (expiresKey !== "invalid") {
      return;
    }
    const resolved = resolveInvitationFormCopy(copy, {
      nameError: "too_long",
      phoneError: null,
      emailError: null,
      expiresAtError: expiresKey,
      maxUsesError: null,
      banner: null,
      pending: false,
      clientReady: true,
      created: false,
    });
    expect(resolved.expiresAtError).toBe(copy.errors.expiresInvalid);
    expect(resolved.nameError).toBe(copy.errors.nameTooLong);
  });
});

describe("parseInvitationFormUiDraft", () => {
  it("accepts the 7-day default and empty assignments", () => {
    expect(parseInvitationFormUiDraft(validDraft()).ok).toBe(true);
    expect(
      parseInvitationFormUiDraft({
        ...validDraft(),
        expiresAt: "nope",
      }).ok,
    ).toBe(false);
  });
});
