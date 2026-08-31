import { companyCustomers } from "@showzy/db/schema/customers";
import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import type { InferColumnsDataTypes } from "drizzle-orm";
import type { z } from "zod";

import {
  customerStatusSchema,
  type customerViewSchema,
} from "../actions/customer-view.contract.js";

type CustomerView = z.output<typeof customerViewSchema>;

export const customerColumns = {
  id: companyCustomers.id,
  name: companyCustomers.name,
  phone: companyCustomers.phone,
  email: companyCustomers.email,
  userId: companyCustomers.userId,
  notes: companyCustomers.notes,
  groupId: companyCustomers.groupId,
  priceListId: companyCustomers.priceListId,
  status: companyCustomers.status,
  createdAt: companyCustomers.createdAt,
  updatedAt: companyCustomers.updatedAt,
};

export type CustomerRow = InferColumnsDataTypes<typeof customerColumns>;

export function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}

function parseCustomerStatus(value: string): "active" | "archived" {
  return parseDbEnum(
    customerStatusSchema,
    value,
    `company_customers row has illegal status "${value}"`,
  );
}

export function toCustomerView(
  row: CustomerRow,
  linkedCounterpartyCount: number,
): CustomerView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    userId: row.userId,
    notes: row.notes,
    groupId: row.groupId,
    priceListId: row.priceListId,
    status: parseCustomerStatus(row.status),
    linkedCounterpartyCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
