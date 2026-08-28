import { CoreInvariantError } from "@showzy/core/errors";
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

export function nullableUuid(value: string | null | undefined): string | null {
  return value ?? null;
}

function parseCustomerStatus(value: string): "active" | "archived" {
  const parsed = customerStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `company_customers row has illegal status "${value}"`,
    );
  }
  return parsed.data;
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
