export type AuthChannel = "phone" | "email";

export type ParsedIdentifier =
  | { readonly channel: "phone"; readonly phoneNumber: string }
  | { readonly channel: "email"; readonly email: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UA_E164_PREFIX = "+380";
const UA_NATIONAL_DIGIT_COUNT = 9;

export function normalizePhone(value: string): string {
  return value.replaceAll(/[^\d+]/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Compose a UA E.164 number from exactly 9 national digits. */
export function composeUaE164(nationalDigits: string): string | null {
  const digits = nationalDigits.replaceAll(/\D/g, "");
  if (digits.length !== UA_NATIONAL_DIGIT_COUNT) {
    return null;
  }
  return `${UA_E164_PREFIX}${digits}`;
}

/** Strip a UA E.164 number (`+380` + 9) back to national digits. */
export function stripUaNationalDigits(value: string): string | null {
  const phone = normalizePhone(value);
  if (!phone.startsWith(UA_E164_PREFIX)) {
    return null;
  }
  const national = phone.slice(UA_E164_PREFIX.length);
  if (
    national.length !== UA_NATIONAL_DIGIT_COUNT ||
    !/^\d{9}$/.test(national)
  ) {
    return null;
  }
  return national;
}

/**
 * National digits for the UA phone field (0–9). Accepts a typed fragment,
 * `+380…`, or `380…` so a paste of a full number does not keep the
 * country code as national digits. A leading `0` is kept so `067…`
 * without a prefix still fails `parseIdentifier`.
 */
export function uaNationalFieldDigits(value: string): string {
  const phone = normalizePhone(value);
  if (phone.startsWith(UA_E164_PREFIX)) {
    return phone.slice(UA_E164_PREFIX.length).slice(0, UA_NATIONAL_DIGIT_COUNT);
  }
  const digits = phone.replaceAll(/\D/g, "");
  if (
    digits.startsWith("380") &&
    digits.length >= 3 + UA_NATIONAL_DIGIT_COUNT
  ) {
    return digits.slice(3, 3 + UA_NATIONAL_DIGIT_COUNT);
  }
  return digits.slice(0, UA_NATIONAL_DIGIT_COUNT);
}

/**
 * Persist field edits for the OTP flow: complete 9 national digits become
 * E.164; a partial or `0…` entry stays digits-only so `parseIdentifier`
 * still rejects it.
 */
export function uaPhoneFieldValue(nationalDigits: string): string {
  const digits = uaNationalFieldDigits(nationalDigits);
  if (digits.startsWith("0")) {
    return digits;
  }
  return composeUaE164(digits) ?? digits;
}

export function parseIdentifier(
  channel: AuthChannel,
  raw: string,
): ParsedIdentifier | null {
  if (channel === "phone") {
    const phoneNumber = normalizePhone(raw);
    if (!E164.test(phoneNumber)) {
      return null;
    }
    return { channel: "phone", phoneNumber };
  }
  const email = normalizeEmail(raw);
  if (!EMAIL.test(email)) {
    return null;
  }
  return { channel: "email", email };
}

export function identifierDestination(identifier: ParsedIdentifier): string {
  return identifier.channel === "phone"
    ? identifier.phoneNumber
    : identifier.email;
}

/** Phone-first accounts get a non-deliverable placeholder (apps/api). */
export function isPlaceholderEmail(email: string | null): boolean {
  return email !== null && email.endsWith("@phone.invalid");
}
