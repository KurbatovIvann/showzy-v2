/**
 * Typed contract client factory (contract.md §3).
 *
 * Apps supply a base URL and session credentials; this module attaches the
 * transport-meta headers (Cookie and/or bearer, active-company selector,
 * idempotency key, confirmation challenge) and returns an oRPC client typed
 * from the contract router. It never interprets permissions — that is
 * core's job after `apps/api` resolves the session (fnd-T26).
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

/** Cookie header value from `@better-auth/expo` `getCookie()`. */
export type CookieProvider = AccessTokenProvider;

export interface ContractClientOptions {
  /**
   * API origin without the `/rpc` suffix, e.g. `https://api.example.com`.
   * The factory appends {@link RPC_PREFIX}.
   */
  readonly baseUrl: string;
  /**
   * Expo/browser session cookie (`Cookie` header). Prefer this for mobile
   * (`@better-auth/expo`). `null` = anonymous.
   */
  readonly getCookie?: CookieProvider;
  /** Optional bearer for non-RN callers. `null` = omit. */
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

async function resolveCredential(
  provider: AccessTokenProvider | undefined,
): Promise<string | null | undefined> {
  if (provider === undefined) {
    return undefined;
  }
  return provider();
}

type RpcFetch = NonNullable<RPCLinkOptions<ContractCallContext>["fetch"]>;

function methodMayHaveBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function rpcPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "invalid-url";
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

declare const __DEV__: boolean | undefined;

function isDevRuntime(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

/**
 * Metro-only transport breadcrumb. Never logs Cookie values, OTP, or
 * authorization secrets — only presence flags, pathname, and error name.
 */
function rpcDevLog(event: {
  readonly phase: "send" | "throw";
  readonly method: string;
  readonly path: string;
  readonly hasCookie: boolean;
  readonly hasIdempotencyKey: boolean;
  readonly bodyChars: number;
  readonly errorName?: string;
}): void {
  if (!isDevRuntime()) {
    return;
  }
  console.info("[showzy/rpc]", event);
}

type RebuiltRpcRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly signal?: AbortSignal;
};

function toRequestInit(rebuilt: RebuiltRpcRequest): RequestInit {
  const init: RequestInit = {
    method: rebuilt.method,
    headers: rebuilt.headers,
    credentials: "omit",
  };
  if (rebuilt.signal !== undefined) {
    init.signal = rebuilt.signal;
  }
  if (rebuilt.body !== undefined) {
    init.body = rebuilt.body;
  }
  return init;
}

function rebuiltDevFields(rebuilt: RebuiltRpcRequest): {
  readonly method: string;
  readonly path: string;
  readonly hasCookie: boolean;
  readonly hasIdempotencyKey: boolean;
  readonly bodyChars: number;
} {
  const cookie = rebuilt.headers.cookie;
  return {
    method: rebuilt.method,
    path: rpcPathname(rebuilt.url),
    hasCookie: cookie !== undefined && cookie !== "",
    hasIdempotencyKey: Object.hasOwn(rebuilt.headers, IDEMPOTENCY_KEY_HEADER),
    bodyChars: rebuilt.body === undefined ? 0 : rebuilt.body.length,
  };
}

/**
 * Rebuild from URL + init. Never `new Request(existingRequest)`: Hermes /
 * whatwg-fetch treat that clone as consuming the original body, and native
 * Request copies drop `Cookie` when `credentials: "omit"` is applied to an
 * existing Request. `credentials: "omit"` still belongs on the init so a
 * cookie jar cannot overwrite the manual Cookie (contract.md §3).
 *
 * Body is the JSON *string* (`request.text()`), not an `ArrayBuffer`.
 * React Native's XHR converter only treats `instanceof ArrayBuffer` as
 * binary; a buffer from another realm is dropped, so `listMine` (`{}`)
 * still parses while `companies.create` never reaches executeAction.
 * String bodies are realm-safe. `redirect: "manual"` is omitted — RN
 * fetch documents it as not working.
 */
async function rpcFetchOmittingCredentials(
  request: Request,
): Promise<RebuiltRpcRequest> {
  const method = request.method;
  const headers = headersToRecord(request.headers);
  const rebuilt: RebuiltRpcRequest = {
    url: request.url,
    method,
    headers,
    signal: request.signal,
  };
  if (!methodMayHaveBody(method)) {
    return rebuilt;
  }
  const body = await request.text();
  if (body.length === 0) {
    return rebuilt;
  }
  return { ...rebuilt, body };
}

function fetchOmittingCredentials(fetchImpl: RpcFetch | undefined): RpcFetch {
  return async (request, init, options, path, input) => {
    let rebuilt: RebuiltRpcRequest;
    try {
      rebuilt = await rpcFetchOmittingCredentials(request);
    } catch (error) {
      rpcDevLog({
        phase: "throw",
        method: request.method,
        path: rpcPathname(request.url),
        hasCookie: request.headers.has("cookie"),
        hasIdempotencyKey: request.headers.has(IDEMPOTENCY_KEY_HEADER),
        bodyChars: 0,
        errorName: errorName(error),
      });
      throw error;
    }
    rpcDevLog({ phase: "send", ...rebuiltDevFields(rebuilt) });
    const fetchInit = toRequestInit(rebuilt);
    try {
      if (fetchImpl !== undefined) {
        return await fetchImpl(
          new Request(rebuilt.url, fetchInit),
          init,
          options,
          path,
          input,
        );
      }
      return await fetch(rebuilt.url, fetchInit);
    } catch (error) {
      rpcDevLog({
        phase: "throw",
        ...rebuiltDevFields(rebuilt),
        errorName: errorName(error),
      });
      throw error;
    }
  };
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
      const cookie = await resolveCredential(options.getCookie);
      headerIfPresent(headers, "cookie", cookie);
      const token = await resolveCredential(options.getAccessToken);
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
    fetch: fetchOmittingCredentials(options.fetch),
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
