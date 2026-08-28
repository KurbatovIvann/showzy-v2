import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  fieldErrorsFromFormState,
  groupMemberHint,
  mapGroupFormFailure,
  mapValidationIssues,
  rhfPathsForFieldErrors,
} from "./group-form-copy";
import type { GroupFormWrite } from "./group-form-plan";
import { emptyFieldErrors } from "./group-form.schema";

describe("mapGroupFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapGroupFormFailure("network")).toBe("network");
    expect(mapGroupFormFailure("offline")).toBe("offline");
    expect(mapGroupFormFailure("permission")).toBe("permission");
    expect(mapGroupFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapGroupFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const write: GroupFormWrite = {
      kind: "createGroup",
      input: { name: "Опт" },
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["name"], message: "secret" },
          { code: "too_big", path: ["description"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      name: "required",
      description: "too_long",
    });
  });

  it("leaves assignment paths as banner-only", () => {
    const write: GroupFormWrite = {
      kind: "createGroup",
      input: { name: "Опт" },
    };
    const assignmentError: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [{ code: "custom", path: ["priceListId"], message: "secret" }],
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
        nameMessage: "required",
        descriptionMessage: "too_long",
        server: null,
      }),
    ).toEqual({
      name: "required",
      description: "too_long",
    });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("puts name required on the name field", () => {
    expect(
      rhfPathsForFieldErrors({
        ...emptyFieldErrors(),
        name: "required",
      }),
    ).toEqual([{ name: "name", message: "required" }]);
  });
});

describe("groupMemberHint", () => {
  it("interpolates the canvas member-count sentence", () => {
    const copy = customersCopy("uk");
    expect(
      groupMemberHint({
        count: 3,
        locale: "uk",
        memberHint: copy.groupForm.memberHint,
        members: copy.members,
      }),
    ).toBe("У групі 3 клієнти. Видалення групи лише прибере це призначення.");
  });
});
