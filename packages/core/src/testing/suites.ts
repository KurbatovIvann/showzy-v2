/**
 * Isolation suites every module instantiates (fnd-T21 — core.md §12).
 *
 * Each registrar adds vitest `it` blocks that call `getKit()` lazily so
 * `beforeAll` can seed first. The `run*` functions are the same
 * assertions without registration, so the kit self-tests can prove a
 * leaky fixture action fails them.
 */
import { randomUUID } from "node:crypto";

import { auditLog, domainEvents } from "@showzy/db";
import { readCrmSentinel } from "@showzy/db/testing/fixtures";
import { eq } from "drizzle-orm";
import { describe, it } from "vitest";
import type { z } from "zod";

import {
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "../errors/index.js";
import type { ImplementedAction } from "../runtime/implement-action.js";
import type { RateLimitHook } from "../runtime/pipeline/types.js";
import {
  createRateLimitHook,
  rateLimitDefaults,
} from "../runtime/rate-limit/create-rate-limit-hook.js";
import { createInMemoryRateLimitStore } from "../runtime/rate-limit/token-bucket.js";
import {
  collectJsonStrings,
  findInternalFieldLeaks,
  findPrivateUserLeaks,
  findUnpublishedLeaks,
} from "./inspect.js";
import { kitIdentities } from "./identities.js";
import {
  createCapturingLogger,
  invokeAction,
  type IsolationActor,
  type TestKit,
} from "./kit.js";

export interface IsolationInvocation extends IsolationActor {
  readonly input: unknown;
}

/**
 * Heterogeneous implemented action as the suites see it. `isolationCase` /
 * `browseCase` collect mixed-principal actions into one list.
 */
export type SuiteAction = ImplementedAction<z.ZodType, z.ZodType, unknown>;

export interface CrossTenantCase {
  readonly action: SuiteAction;
  readonly own: IsolationInvocation;
  readonly foreign: IsolationInvocation;
}

export interface BrowseCase {
  readonly action: SuiteAction;
  readonly input?: unknown;
  readonly userId?: string;
}

export function isolationCase<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  action: ImplementedAction<TInput, TOutput, TTarget>,
  own: IsolationInvocation,
  foreign: IsolationInvocation,
): CrossTenantCase {
  return { action, own, foreign };
}

export function browseCase<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  action: ImplementedAction<TInput, TOutput, TTarget>,
  extras: { readonly input?: unknown; readonly userId?: string } = {},
): BrowseCase {
  return { action, ...extras };
}

function isolationDenied(error: unknown): boolean {
  return (
    error instanceof NotFoundError || error instanceof PermissionDeniedError
  );
}

function denyMessage(actionName: string): string {
  return `expected foreign access to "${actionName}" to be denied`;
}

function leakMessage(actionName: string, detail: string): string {
  return `"${actionName}" leaked ${detail}`;
}

async function invoke(
  kit: TestKit,
  action: SuiteAction,
  call: IsolationInvocation,
  options?: Parameters<typeof invokeAction>[4],
): Promise<unknown> {
  return invokeAction(kit, action, call.input, call, options);
}

function assertDiscoveryClean(actionName: string, output: unknown): void {
  const unpublished = findUnpublishedLeaks(output);
  if (unpublished.length > 0) {
    throw new Error(
      leakMessage(actionName, `unpublished resource ${unpublished.join(", ")}`),
    );
  }
  const internal = findInternalFieldLeaks(output);
  if (internal.length > 0) {
    throw new Error(
      leakMessage(actionName, `internal field ${internal.join(", ")}`),
    );
  }
}

function assertAccountDidNotLeak(
  actionName: string,
  foreignOutput: unknown,
): void {
  const ownIds = [kitIdentities.companies.a, kitIdentities.users.anna];
  const seen = new Set(collectJsonStrings(foreignOutput));
  const hits = ownIds.filter((id) => seen.has(id));
  if (hits.length > 0) {
    throw new Error(
      leakMessage(actionName, `user A's data ${hits.join(", ")}`),
    );
  }
}

async function expectForeignDenied(
  actionName: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isolationDenied(error)) {
      return;
    }
    throw error;
  }
  throw new Error(denyMessage(actionName));
}

/**
 * Own-scope access succeeds; foreign-scope access is denied — or, for
 * public-global / consumer browse, the response contains no unpublished
 * or internal fixture fields.
 */
export async function runCrossTenantCase(
  kit: TestKit,
  c: CrossTenantCase,
): Promise<void> {
  const { action } = c;
  const principal = action.contract.principal;
  const publicScope = action.contract.publicScope;

  if (
    (principal === "public" && publicScope === "globalProjection") ||
    principal === "consumer"
  ) {
    assertDiscoveryClean(
      action.contract.name,
      await invoke(kit, action, c.own),
    );
    return;
  }

  await invoke(kit, action, c.own);

  if (principal === "account") {
    try {
      const output = await invoke(kit, action, c.foreign);
      assertAccountDidNotLeak(action.contract.name, output);
      return;
    } catch (error) {
      if (isolationDenied(error)) {
        return;
      }
      throw error;
    }
  }

  await expectForeignDenied(action.contract.name, () =>
    invoke(kit, action, c.foreign),
  );
}

export function crossTenantSuite(
  getKit: () => TestKit,
  cases: readonly CrossTenantCase[],
): void {
  describe("crossTenantSuite", () => {
    for (const c of cases) {
      it(`${c.action.contract.name} (${c.action.contract.principal}) isolates across tenants`, async () => {
        await runCrossTenantCase(getKit(), c);
      });
    }
  });
}

export async function runPublicProjectionCase(
  kit: TestKit,
  c: BrowseCase,
): Promise<void> {
  const action = c.action;
  if (
    action.contract.principal !== "public" ||
    action.contract.publicScope !== "globalProjection"
  ) {
    throw new Error(
      `"${action.contract.name}" is not a public-global action — publicProjectionSuite only accepts publicScope: globalProjection`,
    );
  }
  if (action.resolveTarget !== undefined) {
    throw new Error(
      `"${action.contract.name}" bound resolveTarget — public-global actions cannot have a resolver`,
    );
  }

  const crmBefore = await readCrmSentinel(kit.db.runtime.db);
  const capturing = createCapturingLogger();
  const output = await invoke(
    kit,
    action,
    { input: c.input ?? {} },
    { deps: { ...kit.pipeline, logger: capturing.logger } },
  );
  assertDiscoveryClean(action.contract.name, output);

  const crmAfter = await readCrmSentinel(kit.db.runtime.db);
  if (JSON.stringify(crmAfter) !== JSON.stringify(crmBefore)) {
    throw new Error(leakMessage(action.contract.name, "a CRM sentinel change"));
  }

  const finished = capturing
    .entries()
    .find((line) => line["msg"] === "action finished");
  if (finished === undefined) {
    throw new Error(
      `"${action.contract.name}" produced no action-finished log`,
    );
  }
  if (
    finished["actor_type"] !== "anonymous" ||
    finished["company_id"] !== null
  ) {
    throw new Error(
      `"${action.contract.name}" log was not anonymous/null-company (actor_type=${String(finished["actor_type"])}, company_id=${String(finished["company_id"])})`,
    );
  }
  if ("client_ip" in finished) {
    throw new Error(
      `"${action.contract.name}" logged a raw client_ip — IPs stay transport-only`,
    );
  }

  await assertPublicIpHmacLimit(kit, action, c.input ?? {});
}

async function assertPublicIpHmacLimit(
  kit: TestKit,
  action: SuiteAction,
  input: unknown,
): Promise<void> {
  const policy = action.contract.rateLimit ?? rateLimitDefaults.public;
  if (policy.scope !== "ipHmac") {
    throw new Error(
      `"${action.contract.name}" is not IP-HMAC rate limited (scope=${policy.scope})`,
    );
  }
  const logger = createCapturingLogger().logger;
  const deps = {
    ...kit.pipeline,
    logger,
    hooks: {
      ...kit.pipeline.hooks,
      rateLimit: createRateLimitHook({
        store: createInMemoryRateLimitStore(),
        ipHmacSecret: "test-kit-ip-hmac-secret",
        logger,
      }),
    },
  };
  const clientIp = "198.51.100.20";
  for (let i = 0; i < policy.limit; i += 1) {
    await invokeAction(kit, action, input, { clientIp }, { deps });
  }
  try {
    await invokeAction(kit, action, input, { clientIp }, { deps });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return;
    }
    throw error;
  }
  throw new Error(
    `"${action.contract.name}" did not rate-limit the ${String(policy.limit + 1)}th public call`,
  );
}

export async function assertUserRateLimit(
  kit: TestKit,
  action: SuiteAction,
  call: IsolationInvocation,
  rateLimitHook?: RateLimitHook,
): Promise<void> {
  const principal = action.contract.principal;
  if (principal !== "consumer" && principal !== "account") {
    throw new Error(
      `"${action.contract.name}" is not a consumer/account action — user rate-limit assertion only applies to those modes`,
    );
  }
  const policy = action.contract.rateLimit ?? rateLimitDefaults[principal];
  if (policy.scope !== "user") {
    throw new Error(
      `"${action.contract.name}" is not user rate limited (scope=${policy.scope})`,
    );
  }
  const logger = createCapturingLogger().logger;
  const deps = {
    ...kit.pipeline,
    logger,
    hooks: {
      ...kit.pipeline.hooks,
      rateLimit:
        rateLimitHook ??
        createRateLimitHook({
          store: createInMemoryRateLimitStore(),
          ipHmacSecret: "test-kit-ip-hmac-secret",
          logger,
        }),
    },
  };
  for (let i = 0; i < policy.limit; i += 1) {
    await invoke(kit, action, call, { deps });
  }
  try {
    await invoke(kit, action, call, { deps });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return;
    }
    throw error;
  }
  throw new Error(
    `"${action.contract.name}" did not rate-limit the ${String(policy.limit + 1)}th ${principal} call`,
  );
}

async function assertNullCompanyProtocolRows(
  kit: TestKit,
  actionName: string,
  requestId: string,
): Promise<void> {
  const eventRows = await kit.db.runtime.db
    .select({ companyId: domainEvents.companyId })
    .from(domainEvents)
    .where(eq(domainEvents.requestId, requestId));
  for (const row of eventRows) {
    if (row.companyId !== null) {
      throw new Error(
        `"${actionName}" emitted a domain_events row with company_id=${row.companyId} — account actions are null-company`,
      );
    }
  }
  const auditRows = await kit.db.runtime.db
    .select({ companyId: auditLog.companyId })
    .from(auditLog)
    .where(eq(auditLog.requestId, requestId));
  for (const row of auditRows) {
    if (row.companyId !== null) {
      throw new Error(
        `"${actionName}" wrote an audit_log row with company_id=${row.companyId} — account actions are null-company`,
      );
    }
  }
}

export function publicProjectionSuite(
  getKit: () => TestKit,
  cases: readonly BrowseCase[],
): void {
  describe("publicProjectionSuite", () => {
    for (const c of cases) {
      it(`${c.action.contract.name} hides unpublished/internal fields, does not touch CRM, logs anonymously, and IP-HMAC rate-limits`, async () => {
        await runPublicProjectionCase(getKit(), c);
      });
    }
  });
}

export async function runConsumerIsolationCase(
  kit: TestKit,
  c: BrowseCase,
): Promise<void> {
  const action = c.action;
  if (action.contract.principal !== "consumer") {
    throw new Error(
      `"${action.contract.name}" is not a consumer action — consumerIsolationSuite only accepts principal: consumer`,
    );
  }

  const crmBefore = await readCrmSentinel(kit.db.runtime.db);
  const output = await invoke(kit, action, {
    input: c.input ?? {},
    userId: c.userId ?? kitIdentities.users.anna,
  });
  assertDiscoveryClean(action.contract.name, output);

  const privateUsers = findPrivateUserLeaks(output);
  if (privateUsers.length > 0) {
    throw new Error(
      leakMessage(
        action.contract.name,
        `private-collection user ${privateUsers.join(", ")}`,
      ),
    );
  }

  const crmAfter = await readCrmSentinel(kit.db.runtime.db);
  if (JSON.stringify(crmAfter) !== JSON.stringify(crmBefore)) {
    throw new Error(leakMessage(action.contract.name, "a CRM sentinel change"));
  }

  await assertUserRateLimit(kit, action, {
    input: c.input ?? {},
    userId: c.userId ?? kitIdentities.users.anna,
  });
}

export function consumerIsolationSuite(
  getKit: () => TestKit,
  cases: readonly BrowseCase[],
): void {
  describe("consumerIsolationSuite", () => {
    for (const c of cases) {
      it(`${c.action.contract.name} hides unpublished entities, private collections, does not touch CRM, and user rate-limits`, async () => {
        await runConsumerIsolationCase(getKit(), c);
      });
    }
  });
}

export async function runAccountIsolationCase(
  kit: TestKit,
  c: CrossTenantCase,
): Promise<void> {
  const action = c.action;
  if (action.contract.principal !== "account") {
    throw new Error(
      `"${action.contract.name}" is not an account action — accountIsolationSuite only accepts principal: account`,
    );
  }
  if (action.contract.permissions.length > 0) {
    throw new Error(
      `"${action.contract.name}" declared permissions ${JSON.stringify(action.contract.permissions)} — account actions must use permissions: []`,
    );
  }

  const capturing = createCapturingLogger();
  const requestId = randomUUID();
  const deps = { ...kit.pipeline, logger: capturing.logger };
  const own = await invoke(kit, action, c.own, {
    deps,
    request: { requestId },
  });
  const ownSeen = new Set(collectJsonStrings(own));
  if (!ownSeen.has(kitIdentities.companies.a)) {
    throw new Error(
      `"${action.contract.name}" own-user call did not return user A's company`,
    );
  }
  if (ownSeen.has(kitIdentities.companies.b)) {
    throw new Error(
      leakMessage(action.contract.name, "user B's company on user A's call"),
    );
  }

  const finished = capturing
    .entries()
    .find((line) => line["msg"] === "action finished");
  if (finished === undefined || finished["company_id"] !== null) {
    throw new Error(
      `"${action.contract.name}" log company_id was ${String(finished?.["company_id"])} — account actions are null-company`,
    );
  }

  await assertNullCompanyProtocolRows(kit, action.contract.name, requestId);
  await assertUserRateLimit(kit, action, c.own);

  try {
    const foreign = await invoke(kit, action, c.foreign);
    assertAccountDidNotLeak(action.contract.name, foreign);
  } catch (error) {
    if (isolationDenied(error)) {
      return;
    }
    throw error;
  }
}

export function accountIsolationSuite(
  getKit: () => TestKit,
  cases: readonly CrossTenantCase[],
): void {
  describe("accountIsolationSuite", () => {
    for (const c of cases) {
      it(`${c.action.contract.name} keeps user B out of user A's companies/personal data, logs a null company, and user rate-limits`, async () => {
        await runAccountIsolationCase(getKit(), c);
      });
    }
  });
}
