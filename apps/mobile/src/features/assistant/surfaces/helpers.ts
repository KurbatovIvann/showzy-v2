/**
 * Shared parse helpers for result-card kinds. Cards stay a projection of
 * live tool parts (ADR-0011). Do not persist list JSON.
 */
import { formatMoneyMinor, groupDigits } from "../../../format/money";
import { confirmationFromChatPart } from "../shared/confirmation";
import {
  isToolErrorOutput,
  type AssistantChatPart,
} from "../shared/confirmation-presenter";
import { toolNameFromPart } from "../shared/turn-timeline";

export const UNLINKED_CUSTOMER_NAME_SNAPSHOT = "unlinked";

const QUANTITY_MILLI_SCALE = 1000n;
const QUANTITY_WIRE = /^(0|[1-9][0-9]*)$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClippedOutput(value: unknown): value is {
  readonly status: "clipped";
  readonly preview: unknown;
  readonly omitted: unknown;
} {
  return isRecord(value) && value["status"] === "clipped";
}

export function unwrapToolOutput(output: unknown): {
  readonly payload: unknown;
  readonly clipped: boolean;
} {
  if (isClippedOutput(output)) {
    return { payload: output.preview, clipped: true };
  }
  return { payload: output, clipped: false };
}

export function isSuccessfulToolOutput(output: unknown): boolean {
  if (output === undefined) {
    return false;
  }
  if (isToolErrorOutput(output)) {
    return false;
  }
  if (confirmationFromChatPart(output) !== undefined) {
    return false;
  }
  return true;
}

export function lastSuccessfulPart(
  parts: readonly AssistantChatPart[],
  matches: (toolName: string) => boolean,
): AssistantChatPart | null {
  let found: AssistantChatPart | null = null;
  for (const part of parts) {
    const toolName = toolNameFromPart(part);
    if (toolName === null || !matches(toolName)) {
      continue;
    }
    if (part.state !== "output-available") {
      continue;
    }
    if (!isSuccessfulToolOutput(part.output)) {
      continue;
    }
    found = part;
  }
  return found;
}

export function formatQuantityLabel(wire: unknown): string | null {
  if (typeof wire !== "string" || !QUANTITY_WIRE.test(wire)) {
    return null;
  }
  const milli = BigInt(wire);
  const units = milli / QUANTITY_MILLI_SCALE;
  const remainder = milli % QUANTITY_MILLI_SCALE;
  const grouped = groupDigits(units.toString(10));
  if (remainder === 0n) {
    return grouped;
  }
  const fraction = remainder.toString(10).padStart(3, "0").replace(/0+$/, "");
  return `${grouped},${fraction}`;
}

export function formatTotal(minor: unknown, currency: unknown): string | null {
  if (typeof minor !== "string" || typeof currency !== "string") {
    return null;
  }
  if (currency.length !== 3) {
    return null;
  }
  try {
    return formatMoneyMinor(minor, currency);
  } catch {
    return null;
  }
}

export function localizeCustomerName(
  nameSnapshot: string,
  missingCustomer: string,
): string {
  if (nameSnapshot === UNLINKED_CUSTOMER_NAME_SNAPSHOT) {
    return missingCustomer;
  }
  return nameSnapshot;
}

export function customerNameFromPayload(
  payload: Record<string, unknown>,
  missingCustomer: string,
): string | null {
  const customer = payload["customer"];
  if (!isRecord(customer)) {
    return null;
  }
  const nameSnapshot = customer["nameSnapshot"];
  if (typeof nameSnapshot !== "string" || nameSnapshot.length === 0) {
    return missingCustomer;
  }
  return localizeCustomerName(nameSnapshot, missingCustomer);
}

export function grossLabels(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const labels: string[] = [];
  for (const row of value) {
    if (!isRecord(row)) {
      continue;
    }
    const formatted = formatTotal(row["grossAmountMinor"], row["currency"]);
    if (formatted !== null) {
      labels.push(formatted);
    }
  }
  return labels;
}
