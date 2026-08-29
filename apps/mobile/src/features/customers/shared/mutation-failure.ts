import { classifyWriteFailure } from "../../../api/classify-write-failure";
import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersMutationCopy } from "../../../i18n/customers";

export type CustomersWriteBannerKey = "offline" | "permission" | "error";

export function mapCustomersWriteFailure(
  kind: QueryFailureKind | null,
): CustomersWriteBannerKey | null {
  return classifyWriteFailure(kind);
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
