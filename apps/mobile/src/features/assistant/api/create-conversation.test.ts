import { describe, expect, it } from "vitest";
import type { MutationCallOptions } from "@showzy/contract";

import { bindCreateConversationMutate } from "./create-conversation";

describe("bindCreateConversationMutate", () => {
  it("calls assistant.createConversation with empty input and attempt options", async () => {
    const calls: Array<{
      readonly input: { title?: string };
      readonly key: string;
    }> = [];
    const mutate = bindCreateConversationMutate({
      client: {
        assistant: {
          createConversation: (input, options: MutationCallOptions) => {
            calls.push({
              input,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              id: "11111111-1111-4111-8111-111111111111",
              userId: "user-1",
              title: null,
              createdAt: "2026-09-01T12:00:00.000Z",
              updatedAt: "2026-09-01T12:00:00.000Z",
            });
          },
        },
      },
    });
    const result = await mutate(
      {},
      { context: { idempotencyKey: "attempt-1" } },
    );
    expect(result.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(calls).toEqual([{ input: {}, key: "attempt-1" }]);
    expect(JSON.stringify(calls[0]?.input)).not.toContain("companyId");
  });
});
