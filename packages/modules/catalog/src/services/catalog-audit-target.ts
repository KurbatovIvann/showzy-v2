import {
  PRODUCT_AUDIT_TYPE,
  VARIANT_AUDIT_TYPE,
  holderAuditTarget,
} from "@showzy/module-kit/audit-target";

export const productAuditTarget = holderAuditTarget({
  type: PRODUCT_AUDIT_TYPE,
  field: "productId",
  fallback: "unknown",
  sources: ["input"],
});

export const variantAuditTarget = holderAuditTarget({
  type: VARIANT_AUDIT_TYPE,
  field: "variantId",
  fallback: "unknown",
  sources: ["input"],
});
