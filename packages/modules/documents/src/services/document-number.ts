import { CoreInvariantError } from "@showzy/core/errors";
import { documentNumberCounters } from "@showzy/db/schema/documents";
import { sql } from "drizzle-orm";
import type { z } from "zod";

import type { documentTypeSchema } from "../actions/document-view.contract.js";
import { requireWritable } from "./writable.js";

type DocumentType = z.output<typeof documentTypeSchema>;
type WritableStaffDb = ReturnType<typeof requireWritable>;

export const PAYMENT_INVOICE_TYPE_CODE = "РХ";
export const DELIVERY_NOTE_TYPE_CODE = "ВН";

export function documentTypeCode(type: DocumentType): string {
  if (type === "payment_invoice") {
    return PAYMENT_INVOICE_TYPE_CODE;
  }
  return DELIVERY_NOTE_TYPE_CODE;
}

/**
 * `{prefix}-{РХ|ВН}-{seq:06}` — no year. Sequence is monotonic per
 * `(company_id, type)` and does not reset at New Year.
 */
export function formatDocumentNumber(
  prefix: string,
  type: DocumentType,
  sequence: bigint,
): string {
  return `${prefix}-${documentTypeCode(type)}-${sequence.toString(10).padStart(6, "0")}`;
}

export async function allocateNextDocumentNumber(
  db: WritableStaffDb,
  companyId: string,
  type: DocumentType,
): Promise<bigint> {
  const allocated = (
    await db
      .insert(documentNumberCounters)
      .values({
        companyId,
        type,
        lastNumber: 1n,
      })
      .onConflictDoUpdate({
        target: [documentNumberCounters.companyId, documentNumberCounters.type],
        set: {
          lastNumber: sql`${documentNumberCounters.lastNumber} + 1`,
        },
      })
      .returning({ lastNumber: documentNumberCounters.lastNumber })
  )[0];
  if (allocated === undefined) {
    throw new CoreInvariantError(
      "documents.createFromOrder counter upsert returned no row",
    );
  }
  return allocated.lastNumber;
}
