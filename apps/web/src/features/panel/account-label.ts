import type { AuthSessionUser } from "../../auth/session-user";
import type { PanelChromeCopy } from "../../i18n/panel/chrome";

export function accountDisplayLabel(
  session: AuthSessionUser | null,
  fallback: string,
): string {
  if (session === null) {
    return fallback;
  }
  if (session.email !== null && session.email !== "") {
    return session.email;
  }
  if (session.phoneNumber !== null && session.phoneNumber !== "") {
    return session.phoneNumber;
  }
  return fallback;
}

export function accountInitials(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "") {
    return "?";
  }
  if (trimmed.startsWith("+")) {
    return trimmed.slice(-2);
  }
  const at = trimmed.indexOf("@");
  const base = at === -1 ? trimmed : trimmed.slice(0, at);
  const first = base.charAt(0);
  return first.toUpperCase();
}

export function roleLabel(
  role: keyof PanelChromeCopy["roles"],
  copy: PanelChromeCopy,
): string {
  return copy.roles[role];
}
