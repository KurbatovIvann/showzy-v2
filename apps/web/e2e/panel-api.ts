/**
 * Browser-only `/api/auth` + `/rpc` interception (SHO-331).
 * Test fixtures — cannot leak into the production bundle.
 */
import type { Page, Route } from "@playwright/test";

import type { CompanyMembership } from "../src/features/companies/api/list-mine";
import {
  COMPANY_SELECTOR_HEADER,
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "../src/test/company-fixtures";

export type PanelApiMockOptions = {
  readonly signedIn?: boolean;
  readonly memberships?: readonly CompanyMembership[];
  readonly listOrdersItems?: readonly unknown[];
};

export const UNMOCKED_RPC_NOT_FOUND = {
  defined: true,
  code: "NOT_FOUND",
  status: 404,
  message: "unmocked rpc",
} as const;

const UNMOCKED_AUTH_NOT_FOUND = {
  defined: true,
  code: "NOT_FOUND",
  status: 404,
  message: "unmocked auth",
} as const;

type CompanyGetJson = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly prefix: string;
  readonly legal: null;
};

export type CompaniesGetFulfillment =
  | { readonly status: 200; readonly body: { readonly json: CompanyGetJson } }
  | { readonly status: 404; readonly body: typeof UNMOCKED_RPC_NOT_FOUND };

export function isAuthGetSessionPath(pathname: string): boolean {
  return pathname.endsWith("/get-session") || pathname.includes("/get-session");
}

/**
 * Public `companies.get` boundary: only a membership match returns a
 * company. Missing or foreign `x-company-id` is the same NOT_FOUND as
 * the unmocked `/rpc` catch-all — never a synthetic tenant.
 */
export function fulfillCompaniesGet(
  memberships: readonly CompanyMembership[],
  companyId: string | undefined,
): CompaniesGetFulfillment {
  if (companyId === undefined || companyId === "") {
    return { status: 404, body: UNMOCKED_RPC_NOT_FOUND };
  }
  const company = memberships.find(
    (membership) => membership.company.id === companyId,
  )?.company;
  if (company === undefined) {
    return { status: 404, body: UNMOCKED_RPC_NOT_FOUND };
  }
  return {
    status: 200,
    body: {
      json: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        prefix: company.prefix,
        legal: null,
      },
    },
  };
}

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json" };
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
}

function sessionPayload(): unknown {
  const user = signedInOwner();
  const now = new Date().toISOString();
  return {
    session: {
      id: "session-1",
      userId: user.id,
      token: "session-token",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: user.id,
      email: user.email,
      name: "",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      phoneNumber: user.phoneNumber,
    },
  };
}

function rpcEnvelope(data: unknown): { readonly json: unknown } {
  return { json: data };
}

/**
 * Install request interception before the first navigation. More specific
 * handlers are registered last so they win over the `/rpc` catch-all.
 */
export async function installPanelApiMocks(
  page: Page,
  options: PanelApiMockOptions = {},
): Promise<void> {
  const signedIn = options.signedIn ?? true;
  const memberships = options.memberships ?? [FLOWERS_MEMBERSHIP];
  const listOrdersItems = options.listOrdersItems ?? [];

  await page.route("**/api/auth/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (isAuthGetSessionPath(path)) {
      await fulfillJson(route, signedIn ? sessionPayload() : null);
      return;
    }
    await fulfillJson(route, UNMOCKED_AUTH_NOT_FOUND, 404);
  });

  await page.route("**/rpc/**", async (route) => {
    await fulfillJson(route, UNMOCKED_RPC_NOT_FOUND, 404);
  });

  await page.route("**/rpc/companies/listMine", async (route) => {
    await fulfillJson(route, rpcEnvelope({ memberships }));
  });

  await page.route("**/rpc/companies/get", async (route) => {
    const fulfillment = fulfillCompaniesGet(
      memberships,
      route.request().headers()[COMPANY_SELECTOR_HEADER],
    );
    await fulfillJson(route, fulfillment.body, fulfillment.status);
  });

  await page.route("**/rpc/orders/list", async (route) => {
    await fulfillJson(
      route,
      rpcEnvelope({
        kind: "page.summary",
        items: listOrdersItems,
        nextCursor: null,
        customerMatchTruncated: false,
      }),
    );
  });
}
