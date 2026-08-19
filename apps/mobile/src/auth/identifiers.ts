export type AuthChannel = "phone" | "email";

export type ParsedIdentifier =
  | { readonly channel: "phone"; readonly phoneNumber: string }
  | { readonly channel: "email"; readonly email: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string): string {
  return value.replaceAll(/[^\d+]/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
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
