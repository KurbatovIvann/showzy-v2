import { holderAuditTarget } from "@showzy/module-kit/audit-target";

export const inviteAuditTarget = holderAuditTarget({
  type: "invite",
  field: "id",
  fallback: "uncreated",
  sources: ["output", "input"],
});
