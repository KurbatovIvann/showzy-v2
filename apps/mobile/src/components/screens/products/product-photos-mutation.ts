/**
 * `catalog.setProductImages` binder (SHO-141). One `useContractMutation`
 * attempt per replace of the ordered fileId list.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type SetProductImagesInput = {
  readonly productId: string;
  readonly fileIds: readonly string[];
};

export type SetProductImagesOutput = {
  readonly productId: string;
  readonly fileIds: readonly string[];
};

export type SetProductImagesTransport = {
  readonly client: {
    readonly catalog: {
      readonly setProductImages: (
        input: { productId: string; fileIds: string[] },
        options: MutationCallOptions,
      ) => Promise<SetProductImagesOutput>;
    };
  };
};

export function bindSetProductImages(client: SetProductImagesTransport) {
  return (
    input: SetProductImagesInput,
    options: MutationCallOptions,
  ): Promise<SetProductImagesOutput> => {
    return client.client.catalog.setProductImages(
      { productId: input.productId, fileIds: [...input.fileIds] },
      options,
    );
  };
}
