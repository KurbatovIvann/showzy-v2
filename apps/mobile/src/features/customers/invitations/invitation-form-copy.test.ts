import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  fieldErrorsFromFormState,
  mapInvitationFormFailure,
  mapValidationIssues,
  rhfPathsForFieldErrors,
} from "./invitation-form-copy";
import type { InvitationFormWrite } from "./invitation-form-plan";
import { emptyFieldErrors } from "./invitation-form.schema";
import { emptyInvitationFormDraft } from "./invitation-form-draft";

describe("mapInvitationFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapInvitationFormFailure("network")).toBe("network");
    expect(mapInvitationFormFailure("offline")).toBe("offline");
    expect(mapInvitationFormFailure("permission")).toBe("permission");
    expect(mapInvitationFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapInvitationFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const input = {
      isReusable: false as const,
      expiresAt: emptyInvitationFormDraft().expiresAt,
      groupId: null,
      priceListId: null,
      name: null,
      phone: null,
      email: null,
    };
    const write: InvitationFormWrite = {
      kind: "createInvite",
      input,
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_big", path: ["name"], message: "secret" },
          { code: "custom", path: ["expiresAt"], message: "secret" },
          { code: "custom", path: ["maxUses"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      name: "too_long",
      phone: null,
      email: null,
      expiresAt: "range",
      maxUses: "invalid",
    });
  });

  it("leaves assignment paths as banner-only", () => {
    const write: InvitationFormWrite = {
      kind: "createInvite",
      input: {
        isReusable: false,
        expiresAt: emptyInvitationFormDraft().expiresAt,
        groupId: null,
        priceListId: null,
        name: null,
        phone: null,
        email: null,
      },
    };
    const assignmentError: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [{ code: "custom", path: ["groupId"], message: "secret" }],
      },
    });
    expect(mapValidationIssues(assignmentError, write)).toBeNull();
  });
});

describe("fieldErrorsFromFormState", () => {
  it("maps submitted RHF messages onto draft keys", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: "too_long",
        phoneMessage: "too_long",
        emailMessage: "too_long",
        expiresAtMessage: "range",
        maxUsesMessage: "invalid",
        server: null,
      }),
    ).toEqual({
      name: "too_long",
      phone: "too_long",
      email: "too_long",
      expiresAt: "range",
      maxUses: "invalid",
    });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("puts expires range on the expiresAt field", () => {
    expect(
      rhfPathsForFieldErrors({
        ...emptyFieldErrors(),
        expiresAt: "range",
      }),
    ).toEqual([{ name: "expiresAt", message: "range" }]);
  });
});

describe("invite form copy keys", () => {
  it("does not surface contract English as UI copy", () => {
    const uk = customersCopy("uk").inviteForm;
    expect(uk.errors.expiresRange).not.toContain("expiresAt must be");
    expect(uk.errors.maxUsesInvalid).not.toContain("Personal invites");
  });
});
