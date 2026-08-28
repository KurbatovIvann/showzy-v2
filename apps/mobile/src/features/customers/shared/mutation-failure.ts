import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersMutationCopy } from "../../../i18n/customers";

export type CustomersWriteBannerKey = "offline" | "permission" | "error";

export function mapCustomersWriteFailure(
  kind: QueryFailureKind | null,
): CustomersWriteBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "offline") {
    return "offline";
  }
  if (kind === "permission") {
    return "permission";
  }
  return "error";
}

export function customersWriteBanner(
  key: CustomersWriteBannerKey | null,
  copy: CustomersMutationCopy,
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
