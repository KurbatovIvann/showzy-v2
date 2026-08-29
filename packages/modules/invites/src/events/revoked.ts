import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const invitesRevoked = defineEvent({
  name: "invites.revoked",
  version: 1,
  scope: "tenant",
  payload: z.object({
    inviteId: z.uuid(),
  }),
});
