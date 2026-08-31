import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../api/errors";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };
