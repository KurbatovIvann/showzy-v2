import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const fileIdHolder = z.object({ fileId: z.string() });

export function fileAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = fileIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "file", id: fromOutput.data.fileId };
  }
  const fromInput = fileIdHolder.safeParse(env.input);
  return {
    type: "file",
    id: fromInput.success ? fromInput.data.fileId : "uncreated",
  };
}
