/**
 * Browser-only `/api/auth` + `/rpc` interception (SHO-331).
 * Test fixtures — cannot leak into the production bundle.
 */
import type { Page, Route } from "@playwright/test";

import type { CompanyMembership } from "../src/features/companies/api/list-mine";
import {
  FLOWERS_MEMBERSHIP,
  signedInOwner,
} from "../src/test/company-fixtures";

const COMPANY_SELECTOR_HEADER = "x-company-id";

export type PanelApiMockOptions = {
  readonly signedIn?: boolean;
  readonly memberships?: readonly CompanyMembership[];
};

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

  await page.route("**/api/auth/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/get-session") || path.includes("/get-session")) {
      await fulfillJson(route, signedIn ? sessionPayload() : null);
      return;
    }
    await fulfillJson(route, {});
  });

  await page.route("**/rpc/**", async (route) => {
    await fulfillJson(
      route,
      {
        defined: true,
        code: "NOT_FOUND",
        status: 404,
        message: "unmocked rpc",
      },
      404,
    );
  });

  await page.route("**/rpc/companies/listMine", async (route) => {
    await fulfillJson(route, rpcEnvelope({ memberships }));
  });

  await page.route("**/rpc/companies/get", async (route) => {
    const companyId = route.request().headers()[COMPANY_SELECTOR_HEADER];
    const current = memberships.find(
      (membership) => membership.company.id === companyId,
    )?.company;
    await fulfillJson(
      route,
      rpcEnvelope({
        id: current?.id ?? "c0c0c0c0-0000-4000-8000-000000000099",
        name: current?.name ?? "unknown",
        slug: current?.slug ?? "unknown",
        prefix: current?.prefix ?? "XX",
        legal: null,
      }),
    );
  });
}
