import { holderAuditTarget } from "@showzy/module-kit/audit-target";

export const groupAuditTarget = holderAuditTarget({
  type: "customer_group",
  field: "id",
  fallback: "uncreated",
  sources: ["output", "input"],
});
