import { isPlaceholderEmail } from "./otp/identifiers";

export type AuthSessionUser = {
  readonly userId: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
};

/**
 * Pull a display user out of a better-auth `useSession` payload.
 * Phone-first accounts hide the non-deliverable placeholder email.
 */
export function userFromSession(data: unknown): AuthSessionUser | null {
  if (typeof data !== "object" || data === null || !("user" in data)) {
    return null;
  }
  const user = data.user;
  if (typeof user !== "object" || user === null || !("id" in user)) {
    return null;
  }
  if (typeof user.id !== "string" || user.id === "") {
    return null;
  }
  const emailRaw =
    "email" in user && typeof user.email === "string" ? user.email : null;
  const email = emailRaw === "" ? null : emailRaw;
  const phoneRaw =
    "phoneNumber" in user && typeof user.phoneNumber === "string"
      ? user.phoneNumber
      : null;
  return {
    userId: user.id,
    email: isPlaceholderEmail(email) ? null : email,
    phoneNumber: phoneRaw === "" ? null : phoneRaw,
  };
}
