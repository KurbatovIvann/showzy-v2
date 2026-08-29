import { randomUUID } from "node:crypto";

import { PermissionDeniedError, ValidationError } from "@showzy/core/errors";
import {
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { user } from "@showzy/db/schema/auth";
import { products } from "@showzy/db/schema/catalog";
import { companies, companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers } from "@showzy/db/schema/customers";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listOrders } from "./list.js";
import {
  formatListOrdersCursor,
  LIST_ORDERS_MAX_LIMIT,
} from "./list.contract.js";

const fixtures = {
  emptyCompany: randomUUID(),
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  confirmed: randomUUID(),
  newestNew: randomUUID(),
  canceled: randomUUID(),
  orphaned: randomUUID(),
  foreign: randomUUID(),
  itemConfirmed: randomUUID(),
  itemNewestNew1: randomUUID(),
  itemNewestNew2: randomUUID(),
  itemCanceled: randomUUID(),
  itemOrphaned: randomUUID(),
  itemForeign: randomUUID(),
};

const clerkUserId = randomUUID();
const noCustomersUserId = randomUUID();

const timestamps = {
  orphaned: new Date("2026-01-01T00:00:00.000Z"),
  canceled: new Date("2026-02-01T00:00:00.000Z"),
  newestNew: new Date("2026-03-01T00:00:00.000Z"),
  confirmed: new Date("2026-04-01T00:00:00.000Z"),
  foreign: new Date("2026-05-01T00:00:00.000Z"),
};

let kit: TestKit;

async function insertOrder(values: {
  id: string;
  itemIds: readonly string[];
  companyId: string;
  customerId: string | null;
  productId: string;
  status: "new" | "confirmed" | "canceled";
  totalGrossMinor: bigint;
  createdAt: Date;
  orderNumber: number;
}): Promise<void> {
  await kit.db.runtime.db.insert(orders).values({
    id: values.id,
    companyId: values.companyId,
    orderNumber: values.orderNumber,
    customerId: values.customerId,
    status: values.status,
    totalNetMinor: values.totalGrossMinor,
    totalTaxMinor: 0n,
    totalGrossMinor: values.totalGrossMinor,
    currency: "UAH",
    createdAt: values.createdAt,
    updatedAt: values.createdAt,
  });
  await kit.db.runtime.db.insert(orderItems).values(
    values.itemIds.map((itemId, index) => ({
      id: itemId,
      companyId: values.companyId,
      orderId: values.id,
      productId: values.productId,
      titleSnapshot: "Seed",
      quantityMilli: 1000n,
      unitPriceMinor: values.totalGrossMinor / BigInt(values.itemIds.length),
      taxTreatment: "exempt" as const,
      netAmountMinor: values.totalGrossMinor / BigInt(values.itemIds.length),
      grossAmountMinor: values.totalGrossMinor / BigInt(values.itemIds.length),
      priceSource: "base" as const,
      resolverVersion: 1,
      createdAt: new Date(values.createdAt.getTime() + index),
    })),
  );
}

beforeAll(async () => {
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;

  await kit.db.runtime.db.insert(companies).values({
    id: fixtures.emptyCompany,
    name: "Empty orders list",
    slug: "empty-orders-list-sho209",
    prefix: "O3",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: fixtures.emptyCompany,
    userId: kitIdentities.users.anna,
    role: "owner",
    permissions: { granted: [], denied: [] },
  });

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.customerA,
      companyId: companyA,
      name: "Customer A",
      phone: "+380111111111",
      email: "alpha-orders-list@example.com",
    },
    {
      id: fixtures.customerB,
      companyId: companyB,
      name: "Customer B",
      phone: "+380222222222",
      email: "beta-orders-list@example.com",
    },
  ]);

  await kit.db.runtime.db.insert(products).values([
    {
      id: fixtures.productA,
      companyId: companyA,
      name: "Cake",
      basePriceMinor: 1500n,
    },
    {
      id: fixtures.productB,
      companyId: companyB,
      name: "Foreign cake",
      basePriceMinor: 100n,
    },
  ]);

  await insertOrder({
    id: fixtures.orphaned,
    itemIds: [fixtures.itemOrphaned],
    companyId: companyA,
    customerId: null,
    productId: fixtures.productA,
    status: "new",
    totalGrossMinor: 100n,
    createdAt: timestamps.orphaned,
    orderNumber: 1,
  });
  await insertOrder({
    id: fixtures.canceled,
    itemIds: [fixtures.itemCanceled],
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    status: "canceled",
    totalGrossMinor: 200n,
    createdAt: timestamps.canceled,
    orderNumber: 2,
  });
  await insertOrder({
    id: fixtures.newestNew,
    itemIds: [fixtures.itemNewestNew1, fixtures.itemNewestNew2],
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    status: "new",
    totalGrossMinor: 1500n,
    createdAt: timestamps.newestNew,
    orderNumber: 3,
  });
  await insertOrder({
    id: fixtures.confirmed,
    itemIds: [fixtures.itemConfirmed],
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    status: "confirmed",
    totalGrossMinor: 400n,
    createdAt: timestamps.confirmed,
    orderNumber: 1042,
  });
  await insertOrder({
    id: fixtures.foreign,
    itemIds: [fixtures.itemForeign],
    companyId: companyB,
    customerId: fixtures.customerB,
    productId: fixtures.productB,
    status: "new",
    totalGrossMinor: 999n,
    createdAt: timestamps.foreign,
    orderNumber: 9999,
  });

  await kit.db.runtime.db.insert(user).values([
    {
      id: clerkUserId,
      name: "Clerk",
      email: "clerk@orders-list-kit.test",
    },
    {
      id: noCustomersUserId,
      name: "No customers view",
      email: "nocustomers@orders-list-kit.test",
    },
  ]);
  await kit.db.runtime.db.insert(companyMembers).values([
    {
      companyId: companyA,
      userId: clerkUserId,
      role: "employee",
      permissions: { granted: [], denied: ["orders:view"] },
    },
    {
      companyId: companyA,
      userId: noCustomersUserId,
      role: "employee",
      permissions: {
        granted: ["orders:view"],
        denied: ["customers:view"],
      },
    },
  ]);
});

afterAll(async () => {
  await kit.db.close();
});

// Staff lists have no resource id: the inherited suite's foreign case is
// Anna selecting company B (membership deny). The handler's company_id
// filter is proven by "does not include another company's orders".
crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listOrders,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
  ],
);

describe("orders.list", () => {
  it("lists orders newest-first with list-row fields, not the get view", async () => {
    const result = await kit.invoke(listOrders, {});

    expect(result.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
      fixtures.canceled,
      fixtures.orphaned,
    ]);
    expect(result.nextCursor).toBeNull();

    const confirmed = result.items.find(
      (row) => row.orderId === fixtures.confirmed,
    );
    expect(confirmed).toEqual({
      orderId: fixtures.confirmed,
      orderNumber: 1042,
      customerId: fixtures.customerA,
      status: "confirmed",
      itemCount: 1,
      totalGrossMinor: "400",
      currency: "UAH",
      createdAt: timestamps.confirmed.toISOString(),
    });

    const newestNew = result.items.find(
      (row) => row.orderId === fixtures.newestNew,
    );
    expect(newestNew?.itemCount).toBe(2);
    expect(newestNew?.totalGrossMinor).toBe("1500");

    const orphaned = result.items.find(
      (row) => row.orderId === fixtures.orphaned,
    );
    expect(orphaned?.customerId).toBeNull();

    expect(Object.keys(confirmed ?? {}).toSorted()).toEqual([
      "createdAt",
      "currency",
      "customerId",
      "itemCount",
      "orderId",
      "orderNumber",
      "status",
      "totalGrossMinor",
    ]);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain("titleSnapshot");
    expect(blob).not.toContain("unitPriceMinor");
    expect(blob).not.toContain("confirmedAt");
    expect(blob).not.toContain("Staff note");
  });

  it("filters by status and returns an empty page for an empty company", async () => {
    const news = await kit.invoke(listOrders, { status: "new" });
    expect(news.items.map((row) => row.orderId)).toEqual([
      fixtures.newestNew,
      fixtures.orphaned,
    ]);
    expect(news.items.every((row) => row.status === "new")).toBe(true);

    const confirmed = await kit.invoke(listOrders, { status: "confirmed" });
    expect(confirmed.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
    ]);

    const canceled = await kit.invoke(listOrders, { status: "canceled" });
    expect(canceled.items.map((row) => row.orderId)).toEqual([
      fixtures.canceled,
    ]);

    const empty = await kit.invoke(
      listOrders,
      {},
      { companyId: fixtures.emptyCompany },
    );
    expect(empty).toEqual({ items: [], nextCursor: null });
  });

  it("paginates on createdAt/id and stops at the last page", async () => {
    const first = await kit.invoke(listOrders, { limit: 2 });
    expect(first.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
    ]);
    expect(first.nextCursor).toBe(
      formatListOrdersCursor(timestamps.newestNew, fixtures.newestNew),
    );

    const second = await kit.invoke(listOrders, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.orderId)).toEqual([
      fixtures.canceled,
      fixtures.orphaned,
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it("does not include another company's orders or leak a foreign cursor", async () => {
    const result = await kit.invoke(listOrders, { status: "all" });
    expect(result.items.map((row) => row.orderId)).not.toContain(
      fixtures.foreign,
    );
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.foreign);
    expect(blob).not.toContain(kitIdentities.companies.b);

    const fromForeign = await kit.invoke(listOrders, {
      cursor: formatListOrdersCursor(timestamps.foreign, fixtures.foreign),
    });
    expect(fromForeign.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
      fixtures.canceled,
      fixtures.orphaned,
    ]);
    expect(JSON.stringify(fromForeign)).not.toContain(fixtures.foreign);
  });

  it("denies staff without orders:view", async () => {
    await expect(
      kit.invoke(
        listOrders,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor and an oversized limit", async () => {
    await expect(
      kit.invoke(listOrders, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listOrders, { limit: LIST_ORDERS_MAX_LIMIT + 1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(kit.invoke(listOrders, { limit: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );

    await expect(
      kit.invoke(listOrders, { query: "not-a-cursor", cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("matches query by order number, #prefix, customer name, and phone", async () => {
    const byNumber = await kit.invoke(listOrders, { query: "1042" });
    expect(byNumber.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
    ]);
    expect(byNumber.items[0]?.orderNumber).toBe(1042);

    const byHash = await kit.invoke(listOrders, { query: "#3" });
    expect(byHash.items.map((row) => row.orderId)).toEqual([
      fixtures.newestNew,
    ]);

    const byName = await kit.invoke(listOrders, { query: "Customer A" });
    expect(byName.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
      fixtures.canceled,
    ]);

    const byPhone = await kit.invoke(listOrders, { query: "111111" });
    expect(byPhone.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
      fixtures.canceled,
    ]);
  });

  it("returns an empty page for wildcard-stripped query and keeps status filter", async () => {
    const wildcards = await kit.invoke(listOrders, { query: "%%" });
    const escaped = await kit.invoke(listOrders, { query: "\\" });
    expect(wildcards).toEqual({ items: [], nextCursor: null });
    expect(escaped).toEqual({ items: [], nextCursor: null });

    const noMatch = await kit.invoke(listOrders, { query: "no-such-order" });
    expect(noMatch).toEqual({ items: [], nextCursor: null });

    const newOnly = await kit.invoke(listOrders, {
      query: "Customer A",
      status: "new",
    });
    expect(newOnly.items.map((row) => row.orderId)).toEqual([
      fixtures.newestNew,
    ]);
  });

  it("does not leak another tenant's number, name, or phone through query", async () => {
    const byForeignNumber = await kit.invoke(listOrders, { query: "9999" });
    expect(byForeignNumber).toEqual({ items: [], nextCursor: null });

    const byOwnNumberOne = await kit.invoke(listOrders, { query: "#1" });
    expect(byOwnNumberOne.items.map((row) => row.orderId)).toEqual([
      fixtures.orphaned,
    ]);

    const byForeignName = await kit.invoke(listOrders, { query: "Customer B" });
    expect(byForeignName).toEqual({ items: [], nextCursor: null });

    const byForeignPhone = await kit.invoke(listOrders, { query: "222222" });
    expect(byForeignPhone).toEqual({ items: [], nextCursor: null });
  });

  it("fails closed when query needs customers.listCustomers without customers:view", async () => {
    const listed = await kit.invoke(
      listOrders,
      {},
      { userId: noCustomersUserId, companyId: kitIdentities.companies.a },
    );
    expect(listed.items.map((row) => row.orderId)).toEqual([
      fixtures.confirmed,
      fixtures.newestNew,
      fixtures.canceled,
      fixtures.orphaned,
    ]);

    await expect(
      kit.invoke(
        listOrders,
        { query: "Customer A" },
        { userId: noCustomersUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    await expect(
      kit.invoke(
        listOrders,
        { query: "1042" },
        { userId: noCustomersUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
