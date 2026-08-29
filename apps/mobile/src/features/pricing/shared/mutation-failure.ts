import { classifyWriteFailure } from "../../../api/classify-write-failure";
import type { QueryFailureKind } from "../../../api/errors";
import type { PricingMutationCopy } from "../../../i18n/pricing";

export type PricingWriteBannerKey = "offline" | "permission" | "error";

export function mapPricingWriteFailure(
  kind: QueryFailureKind | null,
): PricingWriteBannerKey | null {
  return classifyWriteFailure(kind);
}

export function pricingWriteBanner(
  key: PricingWriteBannerKey | null,
  copy: PricingMutationCopy,
): string | null {
  if (key === null) {
    return null;
  }
  if (key === "offline") {
    return copy.offline;
  }
  if (key === "permission") {
    return copy.permission;
  }
  return copy.error;
}
