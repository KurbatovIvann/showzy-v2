/**
 * Typed contract client factory (contract.md §3).
 *
 * Apps supply a base URL and a token provider; this module attaches the
 * transport-meta headers (bearer, active-company selector, idempotency
 * key, confirmation challenge) and returns an oRPC client typed from the
 * contract router. It never interprets permissions — that is core's job
 * after `apps/api` resolves the session (fnd-T26).
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink, type RPCLinkOptions } from "@orpc/client/fetch";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";

import { contractRouter } from "./modules.js";
import { createMutationAttempt } from "./mutation-attempt.js";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "./transport-meta.js";

/** oRPC mount path on `apps/api` (contract.md §3). */
export const RPC_PREFIX = "/rpc";

/**
 * Per-call transport meta. Optional on every procedure: reads omit it;
 * idempotent mutations pass `createMutationAttempt().options`.
 */
export interface ContractCallContext {
  readonly idempotencyKey?: string;
  readonly confirmationChallengeId?: string;
}

export type AccessTokenProvider = () =>
  string | null | undefined | Promise<string | null | undefined>;

export interface ContractClientOptions {
  /**
   * API origin without the `/rpc` suffix, e.g. `https://api.example.com`.
   * The factory appends {@link RPC_PREFIX}.
   */
  readonly baseUrl: string;
  /** Bearer token for cookie-less clients (Expo). `null` = anonymous. */
  readonly getAccessToken?: AccessTokenProvider;
  /** Initial staff company *selector* — never an access grant (ADR-0013). */
  readonly initialCompanyId?: string | null;
  /** Injected by tests; production uses global `fetch`. */
  readonly fetch?: RPCLinkOptions<ContractCallContext>["fetch"];
}

export interface ContractClient<
  TRouter extends AnyContractRouter = typeof contractRouter,
> {
  readonly client: ContractRouterClient<TRouter, ContractCallContext>;
  /** Staff active-company selector header (`x-company-id`). */
  setActiveCompany(companyId: string | null): void;
  getActiveCompany(): string | null;
  createMutationAttempt: typeof createMutationAttempt;
}

function rpcUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${RPC_PREFIX}`;
}

function headerIfPresent(
  headers: Record<string, string>,
  name: string,
  value: string | null | undefined,
): void {
  if (value !== undefined && value !== null && value !== "") {
    headers[name] = value;
  }
}

async function resolveAccessToken(
  getAccessToken: AccessTokenProvider | undefined,
): Promise<string | null | undefined> {
  if (getAccessToken === undefined) {
    return undefined;
  }
  return getAccessToken();
}

/**
 * Builds the typed client. Pass a router type argument in tests that
 * compose sample contracts; production uses the default `contractRouter`.
 */
export function createContractClient<
  TRouter extends AnyContractRouter = typeof contractRouter,
>(options: ContractClientOptions): ContractClient<TRouter> {
  let activeCompanyId: string | null =
    options.initialCompanyId === undefined ? null : options.initialCompanyId;

  const link = new RPCLink<ContractCallContext>({
    url: rpcUrl(options.baseUrl),
    headers: async ({ context }) => {
      const headers: Record<string, string> = {};
      const token = await resolveAccessToken(options.getAccessToken);
      headerIfPresent(headers, "authorization", tokenToBearer(token));
      headerIfPresent(headers, COMPANY_SELECTOR_HEADER, activeCompanyId);
      headerIfPresent(headers, IDEMPOTENCY_KEY_HEADER, context.idempotencyKey);
      headerIfPresent(
        headers,
        CONFIRMATION_CHALLENGE_HEADER,
        context.confirmationChallengeId,
      );
      return headers;
    },
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });

  const client =
    createORPCClient<ContractRouterClient<TRouter, ContractCallContext>>(link);

  return {
    client,
    setActiveCompany(companyId: string | null): void {
      activeCompanyId = companyId;
    },
    getActiveCompany(): string | null {
      return activeCompanyId;
    },
    createMutationAttempt,
  };
}

function tokenToBearer(
  token: string | null | undefined,
): string | null | undefined {
  if (token === undefined || token === null || token === "") {
    return token;
  }
  return `Bearer ${token}`;
}
