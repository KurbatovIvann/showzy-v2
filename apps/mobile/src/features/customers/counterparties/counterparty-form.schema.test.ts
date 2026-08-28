import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import {
  emptyCounterpartyFormDraft,
  parseCounterpartyFormUiDraft,
  validateCounterpartyForm,
} from "./counterparty-form-draft";
import { resolveCounterpartyFormCopy } from "./counterparty-form-copy";
import {
  COUNTERPARTY_BANK_MFO_MAX,
  COUNTERPARTY_BANK_NAME_MAX,
  COUNTERPARTY_EDRPOU_MAX,
  COUNTERPARTY_EMAIL_MAX,
  COUNTERPARTY_IBAN_MAX,
  COUNTERPARTY_LEGAL_ADDRESS_MAX,
  COUNTERPARTY_NAME_MAX,
  COUNTERPARTY_NOTES_MAX,
  COUNTERPARTY_PHONE_MAX,
  counterpartyFormDraftSchema,
  counterpartyFormResolver,
  fieldErrorsFromDraftSchema,
  isNameErrorKey,
} from "./counterparty-form.schema";

const copy = customersCopy("uk").counterpartyForm;
const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function validDraft() {
  return {
    ...emptyCounterpartyFormDraft(),
    name: "ФОП Іваненко",
  };
}

describe("counterpartyFormDraftSchema", () => {
  it("requires a name and accepts blank optional requisites", () => {
    const parsed = counterpartyFormDraftSchema.safeParse(
      emptyCounterpartyFormDraft(),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("required");
    expect(errors.edrpou).toBeNull();
    expect(errors.iban).toBeNull();
    if (errors.name === null) {
      return;
    }
    expect(isNameErrorKey(errors.name)).toBe(true);
    expect(validateCounterpartyForm(validDraft())).toEqual({
      name: null,
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
    });
    expect(
      counterpartyFormDraftSchema.safeParse({
        ...validDraft(),
        customerId: CUSTOMER_ID,
      }).success,
    ).toBe(true);
  });

  it("rejects over-max name and optional fields", () => {
    const parsed = counterpartyFormDraftSchema.safeParse({
      ...emptyCounterpartyFormDraft(),
      name: "x".repeat(COUNTERPARTY_NAME_MAX + 1),
      edrpou: "1".repeat(COUNTERPARTY_EDRPOU_MAX + 1),
      legalAddress: "a".repeat(COUNTERPARTY_LEGAL_ADDRESS_MAX + 1),
      iban: "U".repeat(COUNTERPARTY_IBAN_MAX + 1),
      bankName: "b".repeat(COUNTERPARTY_BANK_NAME_MAX + 1),
      bankMfo: "3".repeat(COUNTERPARTY_BANK_MFO_MAX + 1),
      phone: "4".repeat(COUNTERPARTY_PHONE_MAX + 1),
      email: `${"e".repeat(COUNTERPARTY_EMAIL_MAX)}@x`,
      notes: "n".repeat(COUNTERPARTY_NOTES_MAX + 1),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.name).toBe("too_long");
    expect(errors.edrpou).toBe("too_long");
    expect(errors.legalAddress).toBe("too_long");
    expect(errors.iban).toBe("too_long");
    expect(errors.bankName).toBe("too_long");
    expect(errors.bankMfo).toBe("too_long");
    expect(errors.phone).toBe("too_long");
    expect(errors.email).toBe("too_long");
    expect(errors.notes).toBe("too_long");
  });
});

describe("counterpartyFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await counterpartyFormResolver(
      emptyCounterpartyFormDraft(),
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    const nameKey = result.errors.name?.message;
    expect(nameKey).toBe("required");
    expect(nameKey).not.toBe(copy.errors.nameRequired);
    if (nameKey === undefined || !isNameErrorKey(nameKey)) {
      return;
    }
    const resolved = resolveCounterpartyFormCopy(copy, {
      mode: "create",
      nameError: nameKey,
      edrpouError: null,
      legalAddressError: null,
      ibanError: null,
      bankNameError: null,
      bankMfoError: null,
      phoneError: null,
      emailError: null,
      notesError: null,
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(resolved.nameError).toBe(copy.errors.nameRequired);
  });
});

describe("parseCounterpartyFormUiDraft", () => {
  it("fails a blank unsaved create and accepts a trimmed name", () => {
    expect(parseCounterpartyFormUiDraft(emptyCounterpartyFormDraft()).ok).toBe(
      false,
    );
    const parsed = parseCounterpartyFormUiDraft({
      ...emptyCounterpartyFormDraft(),
      name: "  ФОП Іваненко  ",
    });
    expect(parsed.ok).toBe(true);
  });
});
