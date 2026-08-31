import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { ConflictError, CoreInvariantError } from "@showzy/core/errors";
import {
  orderItems,
  orderNumberCounters,
  orders,
} from "@showzy/db/schema/orders";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { parseDbEnum } from "@showzy/module-kit/parse-db-enum";
import { sql } from "drizzle-orm";
import type { z } from "zod";

import { createOrderInputSchema } from "../actions/create.contract.js";
import {
  orderPriceSourceSchema,
  orderViewSchema,
} from "../actions/order-view.contract.js";
import { ordersCreated } from "../events/created.js";
import { computeExemptNoneLine, titleSnapshot } from "./line-money.js";
import { formatStaffOrderNumber } from "./order-number-format.js";
import { mapOrderNumberUniqueViolation } from "./order-number.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type CreateInput = z.output<typeof createOrderInputSchema>;
type OrderView = z.output<typeof orderViewSchema>;
type OrderItemView = OrderView["items"][number];
type PriceSource = z.output<typeof orderPriceSourceSchema>;
type WritableStaffDb = ReturnType<typeof requireWritable>;

/**
 * Unique backstop: 23505 on `orders_company_id_order_number_uq`.
 * Counter upsert stays on the outer write tx (not rolled back). INSERT
 * is a nested `db.transaction` savepoint so Postgres 25P02 does not
 * abort the action tx; the next loop allocates `last_number + 1`.
 */
const ORDER_NUMBER_ALLOCATE_ATTEMPTS = 8;

async function allocateNextOrderSequence(
  db: WritableStaffDb,
  companyId: string,
): Promise<bigint> {
  const allocated = (
    await db
      .insert(orderNumberCounters)
      .values({
        companyId,
        lastNumber: 1n,
      })
      .onConflictDoUpdate({
        target: [orderNumberCounters.companyId],
        set: {
          lastNumber: sql`${orderNumberCounters.lastNumber} + 1`,
        },
      })
      .returning({ lastNumber: orderNumberCounters.lastNumber })
  )[0];
  if (allocated === undefined) {
    throw new CoreInvariantError(
      "orders.create counter upsert returned no row",
    );
  }
  return allocated.lastNumber;
}

async function insertNumberedHeader(
  db: WritableStaffDb,
  values: {
    readonly id: string;
    readonly companyId: string;
    readonly numberingPrefix: string;
    readonly customerId: string;
    readonly comment: string | null;
    readonly totalNetMinor: bigint;
    readonly totalTaxMinor: bigint;
    readonly totalGrossMinor: bigint;
    readonly currency: string;
  },
): Promise<{ createdAt: Date; orderNumber: string }> {
  let lastConflict: ConflictError | undefined;
  for (
    let attempt = 0;
    attempt < ORDER_NUMBER_ALLOCATE_ATTEMPTS;
    attempt += 1
  ) {
    const sequence = await allocateNextOrderSequence(db, values.companyId);
    const orderNumber = formatStaffOrderNumber(
      values.numberingPrefix,
      sequence,
    );
    try {
      return await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(orders)
          .values({
            id: values.id,
            companyId: values.companyId,
            orderNumber,
            customerId: values.customerId,
            status: "new",
            comment: values.comment,
            totalNetMinor: values.totalNetMinor,
            totalTaxMinor: values.totalTaxMinor,
            totalGrossMinor: values.totalGrossMinor,
            currency: values.currency,
          })
          .returning({
            createdAt: orders.createdAt,
            orderNumber: orders.orderNumber,
          });
        const row = inserted[0];
        if (row === undefined) {
          throw new CoreInvariantError("orders.create insert returned no row");
        }
        return row;
      });
    } catch (error) {
      const mapped = mapOrderNumberUniqueViolation(error);
      if (!(mapped instanceof ConflictError)) {
        throw mapped;
      }
      lastConflict = mapped;
    }
  }
  throw (
    lastConflict ??
    new CoreInvariantError("orders.create failed to allocate order_number")
  );
}

export interface CatalogOrderVariantFact {
  readonly variantId: string;
  readonly name: string;
}

export interface CatalogOrderProductFact {
  readonly productId: string;
  readonly name: string;
  readonly variants: readonly CatalogOrderVariantFact[];
}

export interface ResolvedOrderPrice {
  readonly productId: string;
  readonly variantId: string | null;
  readonly unitPriceMinor: string;
  readonly currency: string;
  readonly source: PriceSource;
  readonly sourceIds: {
    readonly personalPriceId?: string | undefined;
    readonly priceListId?: string | undefined;
    readonly entryId?: string | undefined;
  };
  readonly resolverVersion: number;
}

interface PersistedLine {
  readonly view: OrderItemView;
  readonly row: typeof orderItems.$inferInsert;
}

function requirePriceSource(value: string): PriceSource {
  return parseDbEnum(
    orderPriceSourceSchema,
    value,
    `resolved price source "${value}" is not a snapshot provenance value`,
  );
}

function productFact(
  products: readonly CatalogOrderProductFact[],
  productId: string,
): CatalogOrderProductFact {
  const match = products.find((product) => product.productId === productId);
  if (match === undefined) {
    throw new CoreInvariantError(
      `order facts missing product ${productId} after catalog.getProductOrderFacts`,
    );
  }
  return match;
}

function variantTitleName(
  fact: CatalogOrderProductFact,
  variantId: string | undefined,
): string | undefined {
  if (variantId === undefined) {
    return undefined;
  }
  const match = fact.variants.find(
    (variant) => variant.variantId === variantId,
  );
  if (match === undefined) {
    throw new CoreInvariantError(
      `order facts missing variant ${variantId} on product ${fact.productId}`,
    );
  }
  return match.name;
}

export async function createStaffOrder(env: {
  readonly ctx: StaffCtx;
  readonly input: CreateInput;
  readonly numberingPrefix: string;
  readonly products: readonly CatalogOrderProductFact[];
  readonly prices: readonly ResolvedOrderPrice[];
}): Promise<OrderView> {
  const { ctx, input, numberingPrefix, products, prices } = env;
  if (prices.length !== input.items.length) {
    throw new CoreInvariantError(
      "pricing.resolveProductPrices returned a different item count than create input",
    );
  }

  const first = prices[0];
  if (first === undefined) {
    throw new CoreInvariantError(
      "create input passed Zod min(1) with no prices",
    );
  }
  const currency = first.currency;
  for (const price of prices) {
    if (price.currency !== currency) {
      throw new ConflictError("Order items must share a single currency.");
    }
  }

  const orderId = randomUUID();
  const lines: PersistedLine[] = [];
  let totalNetMinor = 0n;
  let totalTaxMinor = 0n;
  let totalGrossMinor = 0n;

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const price = prices[index];
    if (item === undefined || price === undefined) {
      throw new CoreInvariantError("create line zip went out of range");
    }
    const expectedVariantId = item.variantId ?? null;
    if (
      price.productId !== item.productId ||
      price.variantId !== expectedVariantId
    ) {
      throw new CoreInvariantError(
        `pricing.resolveProductPrices row ${String(index)} does not match the create line`,
      );
    }
    const fact = productFact(products, item.productId);
    const unitPriceMinor = BigInt(price.unitPriceMinor);
    const quantityMilli = BigInt(item.quantityMilli);
    const amounts = computeExemptNoneLine(unitPriceMinor, quantityMilli);
    const itemId = randomUUID();
    const variantId = item.variantId ?? null;
    const view: OrderItemView = {
      itemId,
      productId: item.productId,
      variantId,
      titleSnapshot: titleSnapshot(
        fact.name,
        variantTitleName(fact, item.variantId),
      ),
      quantityMilli: item.quantityMilli,
      unitPriceMinor: price.unitPriceMinor,
      discountKind: amounts.discountKind,
      discountValue: moneyToCanonical(amounts.discountValue),
      discountAmountMinor: moneyToCanonical(amounts.discountAmountMinor),
      taxTreatment: amounts.taxTreatment,
      taxRateBp: amounts.taxRateBp,
      taxAmountMinor: moneyToCanonical(amounts.taxAmountMinor),
      netAmountMinor: moneyToCanonical(amounts.netAmountMinor),
      grossAmountMinor: moneyToCanonical(amounts.grossAmountMinor),
      currency: price.currency,
      priceSource: requirePriceSource(price.source),
      personalPriceId: price.sourceIds.personalPriceId ?? null,
      priceListId: price.sourceIds.priceListId ?? null,
      priceListEntryId: price.sourceIds.entryId ?? null,
      resolverVersion: price.resolverVersion,
    };
    lines.push({
      view,
      row: {
        id: itemId,
        companyId: ctx.companyId,
        orderId,
        productId: item.productId,
        variantId,
        titleSnapshot: view.titleSnapshot,
        quantityMilli,
        unitPriceMinor,
        discountKind: amounts.discountKind,
        discountValue: amounts.discountValue,
        discountAmountMinor: amounts.discountAmountMinor,
        taxTreatment: amounts.taxTreatment,
        taxRateBp: amounts.taxRateBp,
        taxAmountMinor: amounts.taxAmountMinor,
        netAmountMinor: amounts.netAmountMinor,
        grossAmountMinor: amounts.grossAmountMinor,
        currency: price.currency,
        priceSource: view.priceSource,
        personalPriceId: view.personalPriceId,
        priceListId: view.priceListId,
        priceListEntryId: view.priceListEntryId,
        resolverVersion: view.resolverVersion,
      },
    });
    totalNetMinor += amounts.netAmountMinor;
    totalTaxMinor += amounts.taxAmountMinor;
    totalGrossMinor += amounts.grossAmountMinor;
  }

  const comment = input.comment ?? null;
  const db = requireWritable(ctx.db);
  const header = await insertNumberedHeader(db, {
    id: orderId,
    companyId: ctx.companyId,
    numberingPrefix,
    customerId: input.customerId,
    comment,
    totalNetMinor,
    totalTaxMinor,
    totalGrossMinor,
    currency,
  });

  await db.insert(orderItems).values(lines.map((line) => line.row));

  ctx.emit(ordersCreated, {
    aggregate: { type: "order", id: orderId },
    payload: {
      orderId,
      customerId: input.customerId,
      totalGrossMinor: moneyToCanonical(totalGrossMinor),
      currency,
      itemCount: input.items.length,
    },
  });

  return {
    orderId,
    orderNumber: header.orderNumber,
    customerId: input.customerId,
    status: "new",
    comment,
    totalNetMinor: moneyToCanonical(totalNetMinor),
    totalTaxMinor: moneyToCanonical(totalTaxMinor),
    totalGrossMinor: moneyToCanonical(totalGrossMinor),
    currency,
    confirmedAt: null,
    createdAt: header.createdAt.toISOString(),
    items: lines.map((line) => line.view),
  };
}
