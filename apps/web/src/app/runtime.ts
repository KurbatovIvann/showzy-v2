/**
 * App-wide lifecycle composition (SHO-329). Constructs the auth client.
 * `QueryRuntimeProvider` binds active-company lifecycle; that bind stays
 * in `src/api`. This is not a store and must not hold server cache or UI
 * selection.
 */
import { createShowzyAuthClient, type ShowzyAuthClient } from "../auth/client";

export function createAppRuntime(): { readonly authClient: ShowzyAuthClient } {
  return { authClient: createShowzyAuthClient() };
}
