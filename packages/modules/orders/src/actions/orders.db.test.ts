import { randomUUID } from "node:crypto";

import { defineActionContract } from "@showzy/core/contract";
import {
  defineEventHandler,
  eventEnvelopeSchema,
  implementAction,
} from "@showzy/core";
import {
  ConcurrentRetryError,
  ConflictError,
  CoreInvariantError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from "@showzy/core/errors";
import {
  createTestKit,
  crossTenantSuite,
  eventSuite,
  idempotencySuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { auditLog, domainEvents, eventDeliveries } from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers, customerGroups } from "@showzy/db/schema/customers";
import { orderItems, orders } from "@showzy/db/schema/orders";
import {
  personalPrices,
  priceListEntries,
  priceLists,
} from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { confirmOrder } from "./confirm.js";
import { createOrder } from "./create.js";
import { CREATE_ORDER_MAX_ITEMS } from "./create.contract.js";
import { getOrder } from "./get.js";
import { ordersCreated } from "../events/created.js";

const TEST_CREATED_CONSUMER = "orders.test-created-noop";

const fixtures = {
  listCustomer: randomUUID(),
  listGroup: randomUUID(),
  listDefault: randomUUID(),
  groupA: randomUUID(),
  customerA: randomUUID(),
  customerBare: randomUUID(),
  customerB: randomUUID(),
  pPersonal: randomUUID(),
  pCustomerList: randomUUID(),
  pGroupList: randomUUID(),
  pDefault: randomUUID(),
  pBase: randomUUID(),
  pZero: randomUUID(),
  pVariant: randomUUID(),
  pEur: randomUUID(),
  pB: randomUUID(),
  vNamed: randomUUID(),
  personalPPersonal: randomUUID(),
  entryCustomerCustomerList: randomUUID(),
  entryGroupGroupList: randomUUID(),
  entryDefaultDefault: randomUUID(),
  orderIsolationA: randomUUID(),
  orderIsolationB: randomUUID(),
  orderIdempotency: randomUUID(),
  orderIdempotencyConcurrent: randomUUID(),
  orderCanceled: randomUUID(),
  itemIsolationA: randomUUID(),
  itemIsolationB: randomUUID(),
  itemIdempotency: randomUUID(),
  itemIdempotencyConcurrent: randomUUID(),
  itemCanceled: randomUUID(),
};

const clerks = {
  noCreate: randomUUID(),
  noEdit: randomUUID(),
  noView: randomUUID(),
  noProducts: randomUUID(),
  noPricing: randomUUID(),
  noCustomers: randomUUID(),
};

let kit: TestKit;

const emitCreatedThenFail = implementAction(
  defineActionContract({
    name: "orders.emitCreatedThenFail",
    description:
      "Test-local emitter that fails after buffering orders.created.",
    principal: "staff",
    transport: "internal",
    input: z.object({ orderId: z.uuid() }),
    output: z.object({ orderId: z.uuid() }),
    permissions: ["orders:create"],
    aiExposure: "internal",
    risk: "write",
    requiresConfirmation: false,
    idempotent: true,
    emits: ["orders.created"],
    atomicCalls: [],
    atomicCallers: [],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError("emitCreatedThenFail expects staff");
      }
      ctx.emit(ordersCreated, {
        aggregate: { type: "order", id: input.orderId },
        payload: {
          orderId: input.orderId,
          customerId: fixtures.customerA,
          totalGrossMinor: "1",
          currency: "UAH",
          itemCount: 1,
        },
      });
      throw new ConflictError("Injected emit-then-fail.");
    },
    auditTarget: (env) => {
      const input = env.input;
      const orderId =
        typeof input === "object" &&
        input !== null &&
        "orderId" in input &&
        typeof input.orderId === "string"
          ? input.orderId
          : "unknown";
      return { type: "order", id: orderId };
    },
  },
);

const projectCreatedTest = implementAction(
  defineActionContract({
    name: "orders.projectCreatedTest",
    description: "Test-local no-op consumer of orders.created.",
    principal: "system",
    systemScope: "tenant",
    transport: "internal",
    input: eventEnvelopeSchema(ordersCreated.payload),
    output: z.object({ ok: z.literal(true) }),
    permissions: [],
    aiExposure: "internal",
    risk: "write",
    requiresConfirmation: false,
    idempotent: true,
    emits: [],
    atomicCalls: [],
    atomicCallers: [],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: (_input, ctx) => {
      if (ctx.principal !== "system") {
        throw new CoreInvariantError("projectCreatedTest expects system");
      }
      return Promise.resolve({ ok: true as const });
    },
    auditTarget: () => ({ type: "order", id: "test-created-noop" }),
  },
);

const createdNoop = defineEventHandler({
  event: ordersCreated,
  consumer: TEST_CREATED_CONSUMER,
  action: projectCreatedTest,
});

async function insertProduct(values: {
  id: string;
  companyId: string;
  name: string;
  basePriceMinor: bigint;
  currency?: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(products).values({
    id: values.id,
    companyId: values.companyId,
    name: values.name,
    basePriceMinor: values.basePriceMinor,
    ...(values.currency === undefined ? {} : { currency: values.currency }),
  });
}

async function insertSeedOrder(values: {
  id: string;
  itemId: string;
  companyId: string;
  customerId: string;
  productId: string;
  status: "new" | "canceled";
}): Promise<void> {
  await kit.db.runtime.db.insert(orders).values({
    id: values.id,
    companyId: values.companyId,
    customerId: values.customerId,
    status: values.status,
    totalNetMinor: 100n,
    totalTaxMinor: 0n,
    totalGrossMinor: 100n,
    currency: "UAH",
  });
  await kit.db.runtime.db.insert(orderItems).values({
    id: values.itemId,
    companyId: values.companyId,
    orderId: values.id,
    productId: values.productId,
    titleSnapshot: "Seed",
    quantityMilli: 1000n,
    unitPriceMinor: 100n,
    taxTreatment: "exempt",
    netAmountMinor: 100n,
    grossAmountMinor: 100n,
    priceSource: "base",
    resolverVersion: 1,
  });
}

async function countCompanyOrders(companyId: string): Promise<number> {
  const rows = await kit.db.runtime.db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.companyId, companyId));
  return rows.length;
}

async function countConfirmed(companyId: string): Promise<number> {
  const rows = await kit.db.runtime.db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.companyId, companyId), eq(orders.status, "confirmed")),
    );
  return rows.length;
}

async function processedCreatedDeliveries(): Promise<number> {
  const rows = await kit.db.runtime.db
    .select({ eventId: eventDeliveries.eventId })
    .from(eventDeliveries)
    .where(
      and(
        eq(eventDeliveries.consumer, TEST_CREATED_CONSUMER),
        eq(eventDeliveries.status, "processed"),
      ),
    );
  return rows.length;
}

const baseCreateInput = {
  customerId: fixtures.customerA,
  items: [{ productId: fixtures.pBase, quantityMilli: "1000" }],
};

beforeAll(async () => {
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;

  await kit.db.runtime.db.insert(priceLists).values([
    { id: fixtures.listCustomer, companyId: companyA },
    { id: fixtures.listGroup, companyId: companyA },
    {
      id: fixtures.listDefault,
      companyId: companyA,
      isDefault: true,
    },
  ]);
  await kit.db.runtime.db.insert(customerGroups).values({
    id: fixtures.groupA,
    companyId: companyA,
    priceListId: fixtures.listGroup,
  });
  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.customerA,
      companyId: companyA,
      groupId: fixtures.groupA,
      priceListId: fixtures.listCustomer,
    },
    { id: fixtures.customerBare, companyId: companyA },
    { id: fixtures.customerB, companyId: companyB },
  ]);

  await insertProduct({
    id: fixtures.pPersonal,
    companyId: companyA,
    name: "Personal",
    basePriceMinor: 500n,
  });
  await insertProduct({
    id: fixtures.pCustomerList,
    companyId: companyA,
    name: "Customer list",
    basePriceMinor: 500n,
  });
  await insertProduct({
    id: fixtures.pGroupList,
    companyId: companyA,
    name: "Group list",
    basePriceMinor: 500n,
  });
  await insertProduct({
    id: fixtures.pDefault,
    companyId: companyA,
    name: "Default list",
    basePriceMinor: 500n,
  });
  await insertProduct({
    id: fixtures.pBase,
    companyId: companyA,
    name: "Base",
    basePriceMinor: 500n,
  });
  await insertProduct({
    id: fixtures.pZero,
    companyId: companyA,
    name: "Zero",
    basePriceMinor: 0n,
  });
  await insertProduct({
    id: fixtures.pVariant,
    companyId: companyA,
    name: "Coat",
    basePriceMinor: 800n,
  });
  await insertProduct({
    id: fixtures.pEur,
    companyId: companyA,
    name: "Euro",
    basePriceMinor: 100n,
    currency: "EUR",
  });
  await insertProduct({
    id: fixtures.pB,
    companyId: companyB,
    name: "Foreign",
    basePriceMinor: 100n,
  });
  await kit.db.runtime.db.insert(productVariants).values({
    id: fixtures.vNamed,
    companyId: companyA,
    productId: fixtures.pVariant,
    name: "Red",
    basePriceMinor: 900n,
    currency: "UAH",
  });

  await kit.db.runtime.db.insert(personalPrices).values({
    id: fixtures.personalPPersonal,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.pPersonal,
    priceMinor: 100n,
  });
  await kit.db.runtime.db.insert(priceListEntries).values([
    {
      id: fixtures.entryCustomerCustomerList,
      companyId: companyA,
      priceListId: fixtures.listCustomer,
      productId: fixtures.pCustomerList,
      priceMinor: 200n,
    },
    {
      id: fixtures.entryGroupGroupList,
      companyId: companyA,
      priceListId: fixtures.listGroup,
      productId: fixtures.pGroupList,
      priceMinor: 300n,
    },
    {
      id: fixtures.entryDefaultDefault,
      companyId: companyA,
      priceListId: fixtures.listDefault,
      productId: fixtures.pDefault,
      priceMinor: 400n,
    },
  ]);

  await insertSeedOrder({
    id: fixtures.orderIsolationA,
    itemId: fixtures.itemIsolationA,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.pBase,
    status: "new",
  });
  await insertSeedOrder({
    id: fixtures.orderIsolationB,
    itemId: fixtures.itemIsolationB,
    companyId: companyB,
    customerId: fixtures.customerB,
    productId: fixtures.pB,
    status: "new",
  });
  await insertSeedOrder({
    id: fixtures.orderIdempotency,
    itemId: fixtures.itemIdempotency,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.pBase,
    status: "new",
  });
  await insertSeedOrder({
    id: fixtures.orderIdempotencyConcurrent,
    itemId: fixtures.itemIdempotencyConcurrent,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.pBase,
    status: "new",
  });
  await insertSeedOrder({
    id: fixtures.orderCanceled,
    itemId: fixtures.itemCanceled,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.pBase,
    status: "canceled",
  });

  await kit.db.runtime.db.insert(user).values([
    {
      id: clerks.noCreate,
      name: "No create",
      email: "nocreate@orders-kit.test",
    },
    { id: clerks.noEdit, name: "No edit", email: "noedit@orders-kit.test" },
    { id: clerks.noView, name: "No view", email: "noview@orders-kit.test" },
    {
      id: clerks.noProducts,
      name: "No products",
      email: "noproducts@orders-kit.test",
    },
    {
      id: clerks.noPricing,
      name: "No pricing",
      email: "nopricing@orders-kit.test",
    },
    {
      id: clerks.noCustomers,
      name: "No customers",
      email: "nocustomers@orders-kit.test",
    },
  ]);
  await kit.db.runtime.db.insert(companyMembers).values([
    {
      companyId: companyA,
      userId: clerks.noCreate,
      role: "employee",
      permissions: { granted: [], denied: ["orders:create"] },
    },
    {
      companyId: companyA,
      userId: clerks.noEdit,
      role: "employee",
      permissions: { granted: [], denied: ["orders:edit"] },
    },
    {
      companyId: companyA,
      userId: clerks.noView,
      role: "employee",
      permissions: { granted: [], denied: ["orders:view"] },
    },
    {
      companyId: companyA,
      userId: clerks.noProducts,
      role: "employee",
      permissions: { granted: [], denied: ["products:view"] },
    },
    {
      companyId: companyA,
      userId: clerks.noPricing,
      role: "employee",
      permissions: { granted: [], denied: ["pricing:view"] },
    },
    {
      companyId: companyA,
      userId: clerks.noCustomers,
      role: "employee",
      permissions: { granted: [], denied: ["customers:view"] },
    },
  ]);
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      createOrder,
      { input: baseCreateInput },
      {
        input: {
          customerId: fixtures.customerB,
          items: [{ productId: fixtures.pB, quantityMilli: "1000" }],
        },
      },
    ),
    isolationCase(
      confirmOrder,
      { input: { orderId: fixtures.orderIsolationA } },
      { input: { orderId: fixtures.orderIsolationB } },
    ),
    isolationCase(
      getOrder,
      { input: { orderId: fixtures.orderIsolationA } },
      { input: { orderId: fixtures.orderIsolationB } },
    ),
  ],
);

idempotencySuite(
  () => kit,
  [
    {
      action: createOrder,
      input: baseCreateInput,
      conflictingInput: {
        customerId: fixtures.customerA,
        items: [{ productId: fixtures.pZero, quantityMilli: "1000" }],
      },
      readEffect: () => countCompanyOrders(kitIdentities.companies.a),
    },
    {
      action: confirmOrder,
      input: { orderId: fixtures.orderIdempotency },
      conflictingInput: { orderId: fixtures.orderCanceled },
      freshInput: () => ({ orderId: fixtures.orderIdempotencyConcurrent }),
      readEffect: () => countConfirmed(kitIdentities.companies.a),
    },
  ],
);

eventSuite(() => kit, {
  module: "orders",
  emitAction: createOrder,
  emitInput: {
    customerId: fixtures.customerA,
    items: [{ productId: fixtures.pZero, quantityMilli: "2000" }],
  },
  failingEmitAction: emitCreatedThenFail,
  failingEmitInput: { orderId: randomUUID() },
  eventName: "orders.created",
  subscription: createdNoop,
  readProjection: processedCreatedDeliveries,
});

describe("orders.create / confirm / get", () => {
  it("snapshots five-level provenance, titles, money identity, then confirm and get", async () => {
    const created = await kit.invoke(createOrder, {
      customerId: fixtures.customerA,
      comment: "Staff note",
      items: [
        { productId: fixtures.pPersonal, quantityMilli: "1000" },
        { productId: fixtures.pCustomerList, quantityMilli: "1000" },
        { productId: fixtures.pGroupList, quantityMilli: "1000" },
        { productId: fixtures.pDefault, quantityMilli: "1000" },
        { productId: fixtures.pBase, quantityMilli: "1000" },
        {
          productId: fixtures.pVariant,
          variantId: fixtures.vNamed,
          quantityMilli: "500",
        },
      ],
    });

    expect(created.status).toBe("new");
    expect(created.comment).toBe("Staff note");
    expect(created.customerId).toBe(fixtures.customerA);
    expect(created.items).toHaveLength(6);

    const byProduct = new Map(
      created.items.map((item) => [item.productId, item]),
    );
    expect(byProduct.get(fixtures.pPersonal)).toMatchObject({
      titleSnapshot: "Personal",
      unitPriceMinor: "100",
      priceSource: "personal",
      personalPriceId: fixtures.personalPPersonal,
      resolverVersion: 1,
      taxTreatment: "exempt",
      discountKind: "none",
      netAmountMinor: "100",
      grossAmountMinor: "100",
      taxAmountMinor: "0",
    });
    expect(byProduct.get(fixtures.pCustomerList)).toMatchObject({
      unitPriceMinor: "200",
      priceSource: "customer_price_list",
      priceListId: fixtures.listCustomer,
      priceListEntryId: fixtures.entryCustomerCustomerList,
    });
    expect(byProduct.get(fixtures.pGroupList)).toMatchObject({
      unitPriceMinor: "300",
      priceSource: "group_price_list",
      priceListId: fixtures.listGroup,
      priceListEntryId: fixtures.entryGroupGroupList,
    });
    expect(byProduct.get(fixtures.pDefault)).toMatchObject({
      unitPriceMinor: "400",
      priceSource: "default_price_list",
      priceListId: fixtures.listDefault,
      priceListEntryId: fixtures.entryDefaultDefault,
    });
    expect(byProduct.get(fixtures.pBase)).toMatchObject({
      unitPriceMinor: "500",
      priceSource: "base",
    });
    expect(byProduct.get(fixtures.pVariant)).toMatchObject({
      titleSnapshot: "Coat · Red",
      variantId: fixtures.vNamed,
      unitPriceMinor: "900",
      quantityMilli: "500",
      netAmountMinor: "450",
      grossAmountMinor: "450",
    });

    const lineNet = created.items.reduce(
      (sum, item) => sum + BigInt(item.netAmountMinor),
      0n,
    );
    const lineTax = created.items.reduce(
      (sum, item) => sum + BigInt(item.taxAmountMinor),
      0n,
    );
    const lineGross = created.items.reduce(
      (sum, item) => sum + BigInt(item.grossAmountMinor),
      0n,
    );
    expect(lineNet + lineTax).toBe(lineGross);
    expect(created.totalNetMinor).toBe(lineNet.toString(10));
    expect(created.totalTaxMinor).toBe(lineTax.toString(10));
    expect(created.totalGrossMinor).toBe(lineGross.toString(10));

    const dbLines = await kit.db.runtime.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, created.orderId));
    expect(dbLines).toHaveLength(6);
    for (const row of dbLines) {
      expect(row.netAmountMinor + row.taxAmountMinor).toBe(
        row.grossAmountMinor,
      );
    }

    const createdEvents = await kit.db.runtime.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.aggregateId, created.orderId));
    expect(createdEvents.map((row) => row.name)).toContain("orders.created");
    const createdEvent = createdEvents.find(
      (row) => row.name === "orders.created",
    );
    expect(createdEvent?.payload).toMatchObject({
      orderId: created.orderId,
      customerId: fixtures.customerA,
      totalGrossMinor: created.totalGrossMinor,
      currency: "UAH",
      itemCount: 6,
    });
    expect(createdEvent?.payload).not.toHaveProperty("comment");

    const createAudit = await kit.db.runtime.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "orders.create"));
    const thisCreate = createAudit.filter(
      (row) => row.targetId === created.orderId,
    );
    expect(thisCreate.length).toBeGreaterThanOrEqual(1);
    expect(thisCreate[0]?.inputSnapshot).toBeNull();
    expect(thisCreate[0]?.targetType).toBe("order");
    expect(JSON.stringify(thisCreate[0]?.inputSnapshot)).not.toContain(
      "Staff note",
    );

    const confirmed = await kit.invoke(confirmOrder, {
      orderId: created.orderId,
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.customerId).toBe(fixtures.customerA);
    expect(confirmed.confirmedAt).toEqual(expect.any(String));

    const confirmEvents = await kit.db.runtime.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.aggregateId, created.orderId));
    expect(confirmEvents.map((row) => row.name)).toContain("orders.confirmed");

    const confirmAudit = await kit.db.runtime.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "orders.confirm"),
          eq(auditLog.targetId, created.orderId),
        ),
      );
    expect(confirmAudit.length).toBeGreaterThanOrEqual(1);
    expect(confirmAudit[0]?.inputSnapshot).toBeNull();

    const fetched = await kit.invoke(getOrder, { orderId: created.orderId });
    expect(fetched.status).toBe("confirmed");
    expect(fetched.comment).toBe("Staff note");
    expect(fetched.confirmedAt).toBe(confirmed.confirmedAt);
    expect(fetched.totalGrossMinor).toBe(created.totalGrossMinor);
    expect(fetched.items).toHaveLength(6);
    expect(fetched.items.map((item) => item.unitPriceMinor).sort()).toEqual(
      created.items.map((item) => item.unitPriceMinor).sort(),
    );
  });

  it("keeps snapshots after a later catalog price change", async () => {
    const created = await kit.invoke(createOrder, {
      customerId: fixtures.customerBare,
      items: [{ productId: fixtures.pBase, quantityMilli: "1000" }],
    });
    expect(created.items[0]?.unitPriceMinor).toBe("500");

    await kit.db.runtime.db
      .update(products)
      .set({ basePriceMinor: 9999n })
      .where(eq(products.id, fixtures.pBase));

    try {
      const fetched = await kit.invoke(getOrder, { orderId: created.orderId });
      expect(fetched.items[0]?.unitPriceMinor).toBe("500");
      expect(fetched.totalGrossMinor).toBe(created.totalGrossMinor);
    } finally {
      await kit.db.runtime.db
        .update(products)
        .set({ basePriceMinor: 500n })
        .where(eq(products.id, fixtures.pBase));
    }
  });

  it("rejects mixed currencies", async () => {
    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerBare,
        items: [
          { productId: fixtures.pBase, quantityMilli: "1000" },
          { productId: fixtures.pEur, quantityMilli: "1000" },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies missing orders permissions and nested view permissions", async () => {
    const actorCompany = { companyId: kitIdentities.companies.a };
    await expect(
      kit.invoke(createOrder, baseCreateInput, {
        ...actorCompany,
        userId: clerks.noCreate,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      kit.invoke(
        confirmOrder,
        { orderId: fixtures.orderCanceled },
        { ...actorCompany, userId: clerks.noEdit },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      kit.invoke(
        getOrder,
        { orderId: fixtures.orderIsolationA },
        { ...actorCompany, userId: clerks.noView },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      kit.invoke(createOrder, baseCreateInput, {
        ...actorCompany,
        userId: clerks.noProducts,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      kit.invoke(createOrder, baseCreateInput, {
        ...actorCompany,
        userId: clerks.noPricing,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      kit.invoke(createOrder, baseCreateInput, {
        ...actorCompany,
        userId: clerks.noCustomers,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects empty, duplicate, oversized, and malformed lines", async () => {
    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        items: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        items: [
          { productId: fixtures.pBase, quantityMilli: "1000" },
          { productId: fixtures.pBase, quantityMilli: "2000" },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const oversized = Array.from(
      { length: CREATE_ORDER_MAX_ITEMS + 1 },
      () => ({
        productId: randomUUID(),
        quantityMilli: "1000",
      }),
    );
    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        items: oversized,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    for (const quantityMilli of ["0", "-1", "01", "1.5"]) {
      await expect(
        kit.invoke(createOrder, {
          customerId: fixtures.customerA,
          items: [{ productId: fixtures.pBase, quantityMilli }],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    }

    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        comment: "x".repeat(2001),
        items: [{ productId: fixtures.pBase, quantityMilli: "1000" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a missing idempotency key on create and confirm", async () => {
    await expect(
      kit.invoke(
        createOrder,
        baseCreateInput,
        {},
        {
          request: { idempotencyKey: "" },
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      kit.invoke(
        confirmOrder,
        { orderId: fixtures.orderCanceled },
        {},
        { request: { idempotencyKey: "" } },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns NotFound for foreign or missing customers, products, and orders", async () => {
    const missing = randomUUID();
    const missingCustomer = await kit
      .invoke(createOrder, {
        customerId: missing,
        items: [{ productId: fixtures.pBase, quantityMilli: "1000" }],
      })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (error: unknown) => error,
      );
    const foreignCustomer = await kit
      .invoke(createOrder, {
        customerId: fixtures.customerB,
        items: [{ productId: fixtures.pBase, quantityMilli: "1000" }],
      })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (error: unknown) => error,
      );
    expect(missingCustomer).toBeInstanceOf(NotFoundError);
    expect(foreignCustomer).toBeInstanceOf(NotFoundError);
    if (
      missingCustomer instanceof NotFoundError &&
      foreignCustomer instanceof NotFoundError
    ) {
      expect(missingCustomer.clientMessage).toBe(foreignCustomer.clientMessage);
    }

    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        items: [{ productId: missing, quantityMilli: "1000" }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(createOrder, {
        customerId: fixtures.customerA,
        items: [{ productId: fixtures.pB, quantityMilli: "1000" }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const missingOrder = await kit.invoke(getOrder, { orderId: missing }).then(
      () => {
        throw new Error("expected NotFoundError");
      },
      (error: unknown) => error,
    );
    const foreignOrder = await kit
      .invoke(getOrder, { orderId: fixtures.orderIsolationB })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (error: unknown) => error,
      );
    expect(missingOrder).toBeInstanceOf(NotFoundError);
    expect(foreignOrder).toBeInstanceOf(NotFoundError);
    if (
      missingOrder instanceof NotFoundError &&
      foreignOrder instanceof NotFoundError
    ) {
      expect(missingOrder.clientMessage).toBe(foreignOrder.clientMessage);
    }
  });

  it("conflicts when confirming a non-new order", async () => {
    const created = await kit.invoke(createOrder, {
      customerId: fixtures.customerBare,
      items: [{ productId: fixtures.pZero, quantityMilli: "1000" }],
    });
    await kit.invoke(confirmOrder, { orderId: created.orderId });
    await expect(
      kit.invoke(confirmOrder, { orderId: created.orderId }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      kit.invoke(confirmOrder, { orderId: fixtures.orderCanceled }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("serializes concurrent confirms of the same new order", async () => {
    const created = await kit.invoke(createOrder, {
      customerId: fixtures.customerBare,
      items: [{ productId: fixtures.pZero, quantityMilli: "3000" }],
    });
    const results = await Promise.allSettled([
      kit.invoke(confirmOrder, { orderId: created.orderId }),
      kit.invoke(confirmOrder, { orderId: created.orderId }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = rejected[0];
    expect(reason?.status).toBe("rejected");
    if (reason?.status === "rejected") {
      expect(
        reason.reason instanceof ConflictError ||
          reason.reason instanceof ConcurrentRetryError,
      ).toBe(true);
    }
    const row = await kit.db.runtime.db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, created.orderId));
    expect(row[0]?.status).toBe("confirmed");
  });
});
