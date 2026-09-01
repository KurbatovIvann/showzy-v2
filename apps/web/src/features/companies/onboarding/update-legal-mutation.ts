import type { MutationCallOptions } from "@showzy/contract";

import { parseUpdateLegalInput, type UpdateLegalInput } from "./legal-form";

export type UpdateLegalTransport = {
  readonly client: {
    readonly companies: {
      readonly updateLegal: (
        input: UpdateLegalInput,
        options: MutationCallOptions,
      ) => Promise<unknown>;
    };
  };
};

export function bindUpdateLegalMutate(client: UpdateLegalTransport) {
  return (
    input: UpdateLegalInput,
    options: MutationCallOptions,
  ): Promise<unknown> =>
    client.client.companies.updateLegal(parseUpdateLegalInput(input), options);
}
