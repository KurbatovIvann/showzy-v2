/**
 * Uncached staff-assistant turn context (SHO-360). Clock is always
 * present. Company trade name is optional. Working-set ids stay the
 * SHO-347 block, folded into this one system message.
 */

import { staffAssistantClockLines } from "./kyiv-calendar.js";

export function staffAssistantTurnContextAddendum(options: {
  readonly now: Date;
  readonly companyName?: string;
  readonly workingSetAddendum?: string;
}): string {
  const lines: string[] = [
    "Turn context (not cached; changes every turn).",
    staffAssistantClockLines(options.now),
    "Prefer period=today, period=this_week, or period=this_month on orders_list_page and orders_list_counts for those ranges. ISO createdFrom/createdTo remains valid for other intervals.",
  ];
  const companyName = options.companyName?.trim();
  if (companyName !== undefined && companyName !== "") {
    lines.push(`This company is called ${companyName}. Money is UAH.`);
  } else {
    lines.push("Money is UAH.");
  }
  if (
    options.workingSetAddendum !== undefined &&
    options.workingSetAddendum !== ""
  ) {
    lines.push("");
    lines.push(options.workingSetAddendum);
  }
  return lines.join("\n");
}
