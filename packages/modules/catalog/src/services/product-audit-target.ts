import {
  PRODUCT_AUDIT_TYPE,
  holderAuditTarget,
} from "@showzy/module-kit/audit-target";

export const productAuditTarget = holderAuditTarget({
  type: PRODUCT_AUDIT_TYPE,
  field: "productId",
  fallback: "uncreated",
  sources: ["output", "input"],
});
