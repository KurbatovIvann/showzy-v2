import { NotFoundError } from "@showzy/core/errors";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { counterpartyViewSchema } from "../actions/counterparty-view.contract.js";
import { nullableText, nullableUuid } from "./customer-view.js";
import type { WritableStaffDb } from "./writable.js";

type CounterpartyView = z.output<typeof counterpartyViewSchema>;
type CounterpartyCountDb = Pick<WritableStaffDb, "select">;

export const counterpartyReturning = {
  id: counterparties.id,
  name: counterparties.name,
  edrpou: counterparties.edrpou,
  legalAddress: counterparties.legalAddress,
  iban: counterparties.iban,
  bankName: counterparties.bankName,
  bankMfo: counterparties.bankMfo,
  phone: counterparties.phone,
  email: counterparties.email,
  notes: counterparties.notes,
  customerId: counterparties.customerId,
  createdAt: counterparties.createdAt,
  updatedAt: counterparties.updatedAt,
} as const;

export type CounterpartyRow = {
  readonly id: string;
  readonly name: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly customerId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function storedCounterpartyFields(input: {
  readonly name: string;
  readonly edrpou?: string | null | undefined;
  readonly legalAddress?: string | null | undefined;
  readonly iban?: string | null | undefined;
  readonly bankName?: string | null | undefined;
  readonly bankMfo?: string | null | undefined;
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly notes?: string | null | undefined;
  readonly customerId?: string | null | undefined;
}): {
  readonly name: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly customerId: string | null;
} {
  return {
    name: input.name,
    edrpou: nullableText(input.edrpou),
    legalAddress: nullableText(input.legalAddress),
    iban: nullableText(input.iban),
    bankName: nullableText(input.bankName),
    bankMfo: nullableText(input.bankMfo),
    phone: nullableText(input.phone),
    email: nullableText(input.email),
    notes: nullableText(input.notes),
    customerId: nullableUuid(input.customerId),
  };
}

export function toCounterpartyView(
  row: CounterpartyRow,
  customerName: string | null,
): CounterpartyView {
  return {
    id: row.id,
    name: row.name,
    edrpou: row.edrpou,
    legalAddress: row.legalAddress,
    iban: row.iban,
    bankName: row.bankName,
    bankMfo: row.bankMfo,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    customerId: row.customerId,
    customerName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function requireOwnCustomer(
  db: CounterpartyCountDb,
  companyId: string,
  customerId: string,
): Promise<{ id: string; name: string }> {
  const row = (
    await db
      .select({
        id: companyCustomers.id,
        name: companyCustomers.name,
      })
      .from(companyCustomers)
      .where(
        and(
          eq(companyCustomers.companyId, companyId),
          eq(companyCustomers.id, customerId),
        ),
      )
      .limit(1)
  )[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  return row;
}
