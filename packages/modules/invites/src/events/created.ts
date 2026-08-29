import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const invitesCreated = defineEvent({
  name: "invites.created",
  version: 1,
  scope: "tenant",
  payload: z.object({
    inviteId: z.uuid(),
    isReusable: z.boolean(),
    expiresAt: z.iso.datetime(),
  }),
});
