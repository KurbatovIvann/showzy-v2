import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  emptyCustomerFormDraft,
  parseCustomerFormUiDraft,
  validateCustomerForm,
} from "./customer-form-draft";
import { resolveCustomerFormCopy } from "./customer-form-copy";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  customerFormDraftSchema,
  customerFormResolver,
  fieldErrorsFromDraftSchema,
  isNameErrorKey,
} from "./customer-form.schema";

const copy = customersCopy("uk").form;

function validDraft() {
  return {
    ...emptyCustomerFormDraft(),
    name: "Марія",
    phone: "+380670000000",
  };
}

describe("customerFormDraftSchema", () => {
  it("requires a name and at least phone or email", () => {
    const parsed = customerFormDraftSchema.safeParse(emptyCustomerFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("required");
    expect(errors.contact).toBe("required");
    if (errors.name === null) {
      return;
    }
    expect(isNameErrorKey(errors.name)).toBe(true);
  });

  it("accepts phone only, email only, and a kept userId with blank contacts", () => {
    expect(
      customerFormDraftSchema.safeParse({
        ...emptyCustomerFormDraft(),
        name: "Марія",
        phone: "+38067",
      }).success,
    ).toBe(true);
    expect(
      customerFormDraftSchema.safeParse({
        ...emptyCustomerFormDraft(),
        name: "Марія",
        email: "a@b.c",
      }).success,
    ).toBe(true);
    expect(
      customerFormDraftSchema.safeParse({
        ...emptyCustomerFormDraft(),
        name: "Марія",
        userId: "user_abc",
      }).success,
    ).toBe(true);
    expect(validateCustomerForm(validDraft())).toEqual({
      name: null,
      phone: null,
      email: null,
      notes: null,
      contact: null,
    });
  });

  it("rejects over-max name, phone, email, and notes", () => {
    const parsed = customerFormDraftSchema.safeParse({
      ...emptyCustomerFormDraft(),
      name: "x".repeat(CUSTOMER_NAME_MAX + 1),
      phone: "1".repeat(CUSTOMER_PHONE_MAX + 1),
      email: `${"a".repeat(CUSTOMER_EMAIL_MAX)}@x`,
      notes: "n".repeat(CUSTOMER_NOTES_MAX + 1),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("too_long");
    expect(errors.phone).toBe("too_long");
    expect(errors.email).toBe("too_long");
    expect(errors.notes).toBe("too_long");
  });
});

describe("customerFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await customerFormResolver(
      emptyCustomerFormDraft(),
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    const nameKey = result.errors.name?.message;
    const phoneKey = result.errors.phone?.message;
    expect(nameKey).toBe("required");
    expect(phoneKey).toBe("contact");
    expect(nameKey).not.toBe(copy.errors.nameRequired);
    expect(phoneKey).not.toBe(copy.errors.contactRequired);
    if (nameKey === undefined || !isNameErrorKey(nameKey)) {
      return;
    }
    const resolved = resolveCustomerFormCopy(copy, {
      mode: "create",
      nameError: nameKey,
      phoneError: null,
      emailError: null,
      notesError: null,
      contactError: "required",
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(resolved.nameError).toBe(copy.errors.nameRequired);
    expect(resolved.contactError).toBe(copy.errors.contactRequired);
  });
});

describe("parseCustomerFormUiDraft", () => {
  it("fails a blank unsaved create and accepts a trimmed phone contact", () => {
    expect(parseCustomerFormUiDraft(emptyCustomerFormDraft()).ok).toBe(false);
    const parsed = parseCustomerFormUiDraft({
      ...emptyCustomerFormDraft(),
      name: "  Марія  ",
      phone: "  +38067  ",
    });
    expect(parsed.ok).toBe(true);
  });
});
