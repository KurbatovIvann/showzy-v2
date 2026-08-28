import type { QueryFailureKind } from "../../../api/errors";
import type { PricingMutationCopy } from "../../../i18n/pricing";

export type PricingWriteBannerKey = "offline" | "permission" | "error";

export function mapPricingWriteFailure(
  kind: QueryFailureKind | null,
): PricingWriteBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "offline") {
    return "offline";
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "confirmation") {
    return null;
  }
  return "error";
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
