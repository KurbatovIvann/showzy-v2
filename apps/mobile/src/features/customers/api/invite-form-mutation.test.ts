import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { emptyInvitationFormDraft } from "../invitations/invitation-form-draft";
import {
  createInvitePayload,
  type InvitationFormWrite,
} from "../invitations/invitation-form-plan";
import { toInviteRowView } from "../invitations/invitations-list.presenter";
import { invitesWriteInvalidationKeys } from "./customer-cache";
import { bindInviteFormMutate } from "./invite-form-mutation";
import { LIST_INVITES_ACTION } from "./invite.queries";

const INVITE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "plaintext-once";
const URL = "showzy:invite/plaintext-once";

function createOutput() {
  return {
    id: INVITE_ID,
    isReusable: false,
    maxUses: 1,
    usesCount: 0,
    expiresAt: emptyInvitationFormDraft().expiresAt,
    status: "pending" as const,
    groupId: null,
    priceListId: null,
    name: null,
    phone: null,
    email: null,
    invitedBy: "user_1",
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    token: TOKEN,
    url: URL,
  };
}

describe("bindInviteFormMutate", () => {
  it("returns token and url from create output and reuses the attempt key", async () => {
    const calls: Array<{
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const input = createInvitePayload(emptyInvitationFormDraft());
    if (input === null) {
      throw new Error("expected a create payload");
    }
    const write: InvitationFormWrite = { kind: "createInvite", input };
    const controller = createContractMutationController({
      mutate: bindInviteFormMutate({
        client: {
          invites: {
            create: (body, options: MutationCallOptions) => {
              calls.push({
                input: body,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve(createOutput());
            },
          },
        },
      }),
    });

    const result = await controller.submit(write);
    expect(result).toEqual({
      id: INVITE_ID,
      token: TOKEN,
      url: URL,
    });
    await controller.retry();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect("maxUses" in (calls[0]?.input as object)).toBe(false);
  });

  it("rejects a create payload that fails the wire schema before calling transport", async () => {
    const mutate = bindInviteFormMutate({
      client: {
        invites: {
          create: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const result = mutate(
      {
        kind: "createInvite",
        input: {
          isReusable: false,
          expiresAt: "not-a-date",
          groupId: null,
          priceListId: null,
          name: null,
          phone: null,
          email: null,
        },
      },
      {
        context: { idempotencyKey: "k" },
      },
    );
    await expect(result).rejects.toSatisfy(
      (error: unknown) => isWireError(error) && error.code === "VALIDATION",
    );
  });
});

describe("invite secrets stay off list models and query keys", () => {
  it("does not put token or url on list row views or invites.list keys", () => {
    const view = toInviteRowView(
      {
        id: INVITE_ID,
        isReusable: false,
        maxUses: 1,
        usesCount: 0,
        expiresAt: emptyInvitationFormDraft().expiresAt,
        status: "pending",
        groupId: null,
        priceListId: null,
        name: "Maria",
        phone: null,
        email: null,
        invitedBy: "user_1",
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
      },
      new Map(),
      new Map(),
      { reusable: "Reusable", personal: "Invitation" },
    );
    expect("token" in view).toBe(false);
    expect("url" in view).toBe(false);
    const listKey = contractQueryKey(LIST_INVITES_ACTION, "company-a", {});
    expect(JSON.stringify(listKey)).not.toContain("token");
    expect(JSON.stringify(listKey)).not.toContain(TOKEN);
    expect(invitesWriteInvalidationKeys("company-a")).toEqual([
      [LIST_INVITES_ACTION, "company-a"],
    ]);
    const queryClient = createShowzyQueryClient();
    queryClient.setQueryData(listKey, { items: [view] });
    expect(JSON.stringify(queryClient.getQueryData(listKey))).not.toContain(
      TOKEN,
    );
    queryClient.clear();
  });
});
