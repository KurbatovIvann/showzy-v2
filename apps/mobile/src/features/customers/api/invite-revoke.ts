/**
 * Staff invite revoke (SHO-205). `invites.revoke` is idempotent and
 * `requiresConfirmation: false` — UI confirm only, no protocol challenge.
 * Cache invalidation is post-success only — never optimistic. List/get
 * output never includes the plaintext token or hash.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { invitesWriteInvalidationKeys } from "./customer-cache";
import type { InviteListItem } from "./invite.queries";

export type InviteRevokeTransport = {
  readonly client: {
    readonly invites: {
      readonly revoke: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<InviteListItem>;
    };
  };
};

export function bindInviteRevokeMutate(client: InviteRevokeTransport) {
  return (
    input: { id: string },
    options: MutationCallOptions,
  ): Promise<InviteListItem> => {
    return client.client.invites.revoke(input, options);
  };
}

export async function invalidateInvitesAfterWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    invitesWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
