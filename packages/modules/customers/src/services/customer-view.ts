import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import type { z } from "zod";

import {
  customerStatusSchema,
  type customerViewSchema,
} from "../actions/customer-view.contract.js";

type CustomerView = z.output<typeof customerViewSchema>;

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
  row: {
    readonly id: string;
    readonly name: string;
    readonly phone: string | null;
    readonly email: string | null;
    readonly userId: string | null;
    readonly notes: string | null;
    readonly groupId: string | null;
    readonly priceListId: string | null;
    readonly status: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  },
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
