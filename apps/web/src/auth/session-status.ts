/**
 * Map better-auth `useSession().isPending` onto the panel's session
 * status. A refetch (tab focus) must not return to `loading` after the
 * first settle — `_auth` used to unmount `OtpProvider` on that flicker
 * and bounce `/verify` back to `/sign-in`.
 */
export type AuthStatus = "loading" | "anonymous" | "authenticated";

export function authStatusFromSessionQuery(
  isPending: boolean,
  hasSession: boolean,
  previous: AuthStatus | null,
): AuthStatus {
  if (isPending) {
    if (previous === "anonymous" || previous === "authenticated") {
      return previous;
    }
    return "loading";
  }
  return hasSession ? "authenticated" : "anonymous";
}
