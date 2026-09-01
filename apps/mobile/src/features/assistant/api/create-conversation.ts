/**
 * `assistant.createConversation` binder (SHO-323). Company id is never
 * input — tenant scope is the verified membership + selector header.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type CreateConversationView = {
  readonly id: string;
  readonly userId: string;
  readonly title: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateConversationTransport = {
  readonly client: {
    readonly assistant: {
      readonly createConversation: (
        input: { title?: string },
        options: MutationCallOptions,
      ) => Promise<CreateConversationView>;
    };
  };
};

export function bindCreateConversationMutate(
  client: CreateConversationTransport,
) {
  return (
    input: { readonly title?: string },
    options: MutationCallOptions,
  ): Promise<CreateConversationView> => {
    return client.client.assistant.createConversation(input, options);
  };
}
