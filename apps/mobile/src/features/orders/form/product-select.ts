/**
 * Product picker row view-model (SHO-242). Kept out of the sheet so the
 * form hook does not import JSX.
 */
export type ProductSelectRow = {
  readonly id: string;
  readonly name: string;
  readonly variantsLabel: string;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
};
