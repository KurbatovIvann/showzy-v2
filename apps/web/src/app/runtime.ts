/**
 * App-wide lifecycle composition (SHO-329). Wires existing auth-client
 * construction and re-exports the active-company bind from `src/api`.
 * This is not a store and must not hold server cache or UI selection.
 */
import { bindActiveCompanyRuntime } from "../api/active-company-runtime";
import { createShowzyAuthClient, type ShowzyAuthClient } from "../auth/client";

export function createAppRuntime(): { readonly authClient: ShowzyAuthClient } {
  return { authClient: createShowzyAuthClient() };
}

export { bindActiveCompanyRuntime };
