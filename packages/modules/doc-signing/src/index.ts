/**
 * Actions only. The `documents.cancelled` subscriber lives at
 * `./subscriptions` so `documents.get` can import `./get` without evaluating
 * `defineEventHandler` (SHO-256 nest; copy doc-generation get-artifact).
 */
import { abandonRequest } from "./actions/abandon-request.js";
import { completeSigning } from "./actions/complete.js";
import { getSigning } from "./actions/get.js";
import { getSupplierSignedFlags } from "./actions/get-supplier-signed-flags.js";
import { startSigning } from "./actions/start.js";

export { abandonRequest };
export { completeSigning };
export { getSigning };
export { getSupplierSignedFlags };
export { startSigning };
export { docSigningRecorded } from "./events/recorded.js";

export const docSigningActions = [
  abandonRequest,
  completeSigning,
  getSigning,
  getSupplierSignedFlags,
  startSigning,
] as const;
