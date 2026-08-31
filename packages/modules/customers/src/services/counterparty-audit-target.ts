import { holderAuditTarget } from "@showzy/module-kit/audit-target";

export const counterpartyAuditTarget = holderAuditTarget({
  type: "counterparty",
  field: "id",
  fallback: "uncreated",
  sources: ["output", "input"],
});
