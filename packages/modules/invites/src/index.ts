import { acceptInvite } from "./actions/accept.js";
import { createInvite } from "./actions/create.js";
import { getInvite } from "./actions/get.js";
import { listInvites } from "./actions/list.js";
import { revokeInvite } from "./actions/revoke.js";

export { acceptInvite };
export { createInvite };
export { getInvite };
export { listInvites };
export { revokeInvite };
export { invitesAccepted } from "./events/accepted.js";
export { invitesCreated } from "./events/created.js";
export { invitesRevoked } from "./events/revoked.js";

export const invitesActions = [
  acceptInvite,
  createInvite,
  getInvite,
  listInvites,
  revokeInvite,
] as const;
