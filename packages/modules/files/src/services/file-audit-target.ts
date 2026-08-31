import { holderAuditTarget } from "@showzy/module-kit/audit-target";

export const fileAuditTarget = holderAuditTarget({
  type: "file",
  field: "fileId",
  fallback: "uncreated",
  sources: ["output", "input"],
});
