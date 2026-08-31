import {
  VARIANT_AUDIT_TYPE,
  holderAuditTarget,
} from "@showzy/module-kit/audit-target";

export const variantAuditTarget = holderAuditTarget({
  type: VARIANT_AUDIT_TYPE,
  field: "variantId",
  fallback: "uncreated",
  sources: ["output", "input"],
});
