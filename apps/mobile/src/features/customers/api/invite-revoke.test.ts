import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { invitesWriteInvalidationKeys } from "./customer-cache";
import {
  bindInviteRevokeMutate,
  invalidateInvitesAfterWrite,
} from "./invite-revoke";
import { LIST_INVITES_ACTION, type InviteListItem } from "./invite.queries";

const INVITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function inviteView(overrides: Partial<InviteListItem> = {}): InviteListItem {
  return {
    id: INVITE_ID,
    isReusable: false,
    maxUses: 1,
    usesCount: 0,
    expiresAt: "2026-09-05T00:00:00.000Z",
    status: "revoked",
    groupId: null,
    priceListId: null,
    name: "Maria",
    phone: null,
    email: null,
    invitedBy: "user_1",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("bindInviteRevokeMutate", () => {
  it("forwards id and attempt options to invites.revoke", async () => {
    const keys: string[] = [];
    const controller = createContractMutationController<
      { id: string },
      InviteListItem
    >({
      mutate: bindInviteRevokeMutate({
        client: {
          invites: {
            revoke: (input, options: MutationCallOptions) => {
              keys.push(options.context.idempotencyKey);
              return Promise.resolve(inviteView({ id: input.id }));
            },
          },
        },
      }),
    });

    const result = await controller.submit({ id: INVITE_ID });
    expect(result.id).toBe(INVITE_ID);
    expect(result.status).toBe("revoked");
    expect("token" in result).toBe(false);
    expect(keys[0]?.length).toBeGreaterThan(0);
  });
});

describe("invitesWriteInvalidationKeys", () => {
  it("targets invites.list for the active company only", () => {
    expect(invitesWriteInvalidationKeys("company-a")).toEqual([
      [LIST_INVITES_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful revoke without touching other companies", async () => {
    const queryClient = createShowzyQueryClient();
    const listKey = contractQueryKey(LIST_INVITES_ACTION, "company-a", {});
    const otherKey = contractQueryKey(LIST_INVITES_ACTION, "company-b", {});
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { items: [] });

    await invalidateInvitesAfterWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);

    await invalidateInvitesAfterWrite({
      queryClient,
      companyId: null,
    });
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
