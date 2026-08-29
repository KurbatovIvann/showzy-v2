import type { AuditTargetEnv } from "@showzy/core";
import { z } from "zod";

const inviteIdHolder = z.object({ id: z.string() });

export function inviteAuditTarget(env: AuditTargetEnv): {
  type: string;
  id: string;
} {
  const fromOutput = inviteIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "invite", id: fromOutput.data.id };
  }
  const fromInput = inviteIdHolder.safeParse(env.input);
  return {
    type: "invite",
    id: fromInput.success ? fromInput.data.id : "uncreated",
  };
}
