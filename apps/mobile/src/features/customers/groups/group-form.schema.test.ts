import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  emptyGroupFormDraft,
  parseGroupFormUiDraft,
  validateGroupForm,
} from "./group-form-draft";
import { resolveGroupFormCopy } from "./group-form-copy";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  fieldErrorsFromDraftSchema,
  groupFormDraftSchema,
  groupFormResolver,
  isNameErrorKey,
} from "./group-form.schema";

const copy = customersCopy("uk").groupForm;

function validDraft() {
  return {
    ...emptyGroupFormDraft(),
    name: "Опт",
  };
}

describe("groupFormDraftSchema", () => {
  it("requires a name and accepts an empty description", () => {
    const parsed = groupFormDraftSchema.safeParse(emptyGroupFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("required");
    expect(errors.description).toBeNull();
    if (errors.name === null) {
      return;
    }
    expect(isNameErrorKey(errors.name)).toBe(true);
    expect(validateGroupForm(validDraft())).toEqual({
      name: null,
      description: null,
    });
  });

  it("rejects over-max name and description", () => {
    const parsed = groupFormDraftSchema.safeParse({
      ...emptyGroupFormDraft(),
      name: "x".repeat(GROUP_NAME_MAX + 1),
      description: "n".repeat(GROUP_DESCRIPTION_MAX + 1),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("too_long");
    expect(errors.description).toBe("too_long");
  });
});

describe("groupFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await groupFormResolver(emptyGroupFormDraft(), undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    const nameKey = result.errors.name?.message;
    expect(nameKey).toBe("required");
    expect(nameKey).not.toBe(copy.errors.nameRequired);
    if (nameKey === undefined || !isNameErrorKey(nameKey)) {
      return;
    }
    const resolved = resolveGroupFormCopy(copy, {
      mode: "create",
      nameError: nameKey,
      descriptionError: null,
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(resolved.nameError).toBe(copy.errors.nameRequired);
  });
});

describe("parseGroupFormUiDraft", () => {
  it("fails a blank unsaved create and accepts a trimmed name", () => {
    expect(parseGroupFormUiDraft(emptyGroupFormDraft()).ok).toBe(false);
    const parsed = parseGroupFormUiDraft({
      ...emptyGroupFormDraft(),
      name: "  Опт  ",
    });
    expect(parsed.ok).toBe(true);
  });
});
