import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const invitesAccepted = defineEvent({
  name: "invites.accepted",
  version: 1,
  scope: "tenant",
  payload: z.object({
    inviteId: z.uuid(),
    customerId: z.uuid(),
    created: z.boolean(),
  }),
});
