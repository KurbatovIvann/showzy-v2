import { holderAuditTarget } from "@showzy/module-kit/audit-target";

export const customerAuditTarget = holderAuditTarget({
  type: "customer",
  field: "id",
  fallback: "uncreated",
  sources: ["output", "input"],
});
