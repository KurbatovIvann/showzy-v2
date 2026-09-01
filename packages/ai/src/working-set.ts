/**
 * Server working-set addendum from persisted tool-run refs (SHO-347).
 * Ids and action names only — never status, names, or tool JSON.
 */

export const STAFF_ASSISTANT_WORKING_SET_RUNS_MAX = 50;
export const STAFF_ASSISTANT_WORKING_SET_IDS_MAX = 50;

export interface StaffAssistantWorkingSetRun {
  readonly actionName: string;
  readonly resultIds: readonly string[];
  readonly outcome: string;
}

/**
 * Short English system addendum, or undefined when there are no success
 * ids to replay. Newest runs win when the id cap is hit.
 */
export function staffAssistantWorkingSetAddendum(
  runs: readonly StaffAssistantWorkingSetRun[],
): string | undefined {
  const windowed = runs.slice(-STAFF_ASSISTANT_WORKING_SET_RUNS_MAX);
  const grouped = new Map<string, string[]>();
  let remaining = STAFF_ASSISTANT_WORKING_SET_IDS_MAX;

  for (let index = windowed.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const run = windowed[index];
    if (run === undefined || run.outcome !== "success") {
      continue;
    }
    let bucket = grouped.get(run.actionName);
    if (bucket === undefined) {
      bucket = [];
      grouped.set(run.actionName, bucket);
    }
    for (const id of run.resultIds) {
      if (remaining <= 0) {
        break;
      }
      if (bucket.includes(id)) {
        continue;
      }
      bucket.push(id);
      remaining -= 1;
    }
  }

  const lines: string[] = [];
  for (const [actionName, ids] of grouped) {
    if (ids.length === 0) {
      continue;
    }
    lines.push(`${actionName}: ${ids.join(", ")}`);
  }
  if (lines.length === 0) {
    return undefined;
  }

  return `Working set from earlier tool runs in this conversation (ids only; not live record state). This is not a list of what you can do.
${lines.join("\n")}

Do not call a list tool solely to recover these ids. Call get or create with them. Re-list if the staff member asks for a refresh or these ids are insufficient.`;
}
