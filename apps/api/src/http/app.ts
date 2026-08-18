/**
 * The Hono HTTP app (ADR-0003, contract.md §3): request-id, trusted-proxy
 * IP, better-auth, oRPC at `/rpc`, OpenAPI REST aliases at `/api/v1`, and
 * a liveness endpoint. Business logic does not live here — every action
 * runs `executeAction` through the contract server router.
 */
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  RPC_PREFIX,
  type ContractModuleMap,
} from "@showzy/contract";
import {
  buildServerRouter,
  wireErrorInterceptors,
  type TransportInvocationContext,
} from "@showzy/contract/server";
import type {
  ActionPipelineDeps,
  ActionRegistry,
  SessionPrincipal,
} from "@showzy/core";
import { Hono, type Context } from "hono";

import { resolveClientIp } from "./client-ip.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id.js";

/** OpenAPI REST aliases (contract.md §3). Distinct from `/api/auth`. */
export const REST_PREFIX = "/api/v1";

export const AUTH_PREFIX = "/api/auth";

export const HEALTH_PATH = "/health";

/**
 * The better-auth instance as the transport sees it: session lookup plus
 * the HTTP handler. Callers pass the `betterAuth(...)` return value.
 */
export interface AuthInstance {
  handler: (request: Request) => Promise<Response> | Response;
  api: {
    getSession: (args: {
      headers: Headers;
    }) => Promise<{ user: { id: string } } | null>;
  };
}

type AppEnv = {
  Variables: {
    requestId: string;
    clientIp: string;
  };
};

export interface CreateAppOptions {
  readonly auth: AuthInstance;
  readonly registry: ActionRegistry;
  readonly contractModules: ContractModuleMap;
  readonly pipeline: ActionPipelineDeps;
  readonly trustedProxies: readonly string[];
  /** Socket peer. Tests inject a header-backed function; boot uses getConnInfo. */
  readonly getPeerAddress: (c: Context<AppEnv>) => string;
}

function requiresSession(principal: string): boolean {
  return principal !== "public";
}

function sessionGate(registry: ActionRegistry) {
  return async (options: {
    next: () => Promise<unknown>;
    context: TransportInvocationContext;
    path: readonly string[];
  }): Promise<unknown> => {
    const contract = registry.getContract(options.path.join("."));
    if (
      contract !== undefined &&
      requiresSession(contract.principal) &&
      options.context.session === null
    ) {
      throw new ORPCError("UNAUTHORIZED", {
        status: 401,
        message: "Authentication required.",
      });
    }
    return options.next();
  };
}

async function resolveSession(
  auth: AuthInstance,
  headers: Headers,
): Promise<SessionPrincipal | null> {
  const result = await auth.api.getSession({ headers });
  if (result === null) {
    return null;
  }
  return { userId: result.user.id };
}

function headerOrNull(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value === null || value === "" ? null : value;
}

function optionalHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name);
  return value === null || value === "" ? undefined : value;
}

interface TransportRequest {
  readonly req: { readonly raw: Request };
  get(key: "requestId" | "clientIp"): string;
}

async function buildTransportContext(
  c: TransportRequest,
  auth: AuthInstance,
): Promise<TransportInvocationContext> {
  const headers = c.req.raw.headers;
  const session = await resolveSession(auth, headers);
  const idempotencyKey = optionalHeader(headers, IDEMPOTENCY_KEY_HEADER);
  const confirmationChallengeId = optionalHeader(
    headers,
    CONFIRMATION_CHALLENGE_HEADER,
  );
  return {
    requestId: c.get("requestId"),
    channel: "ui",
    session,
    companySelector: headerOrNull(headers, COMPANY_SELECTOR_HEADER),
    clientIp: c.get("clientIp"),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    ...(confirmationChallengeId !== undefined
      ? { confirmationChallengeId }
      : {}),
  };
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Overwrite forwarded-IP headers with the trusted-proxy-normalized address
 * before better-auth sees the request, so its own IP rate limiter cannot be
 * keyed off a spoofed header (security-operations §2).
 */
function requestWithTrustedIp(request: Request, clientIp: string): Request {
  const headers = new Headers(request.headers);
  headers.delete("x-real-ip");
  headers.set("x-forwarded-for", clientIp);
  return new Request(request, { headers });
}

export function createApp(options: CreateAppOptions): Hono<AppEnv> {
  const serverRouter = buildServerRouter(options.contractModules, {
    registry: options.registry,
    pipeline: options.pipeline,
  });
  const interceptors = [
    sessionGate(options.registry),
    ...wireErrorInterceptors,
  ];
  // RPCHandler mutates `clientInterceptors` (prepends StrictGetMethodPlugin).
  // Copy so OpenAPI does not inherit a check whose matching context symbol
  // was never set — that surfaces as a generic 500.
  const rpcHandler = new RPCHandler(serverRouter, {
    clientInterceptors: [...interceptors],
  });
  const openApiHandler = new OpenAPIHandler(serverRouter, {
    clientInterceptors: [...interceptors],
  });

  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
    c.set("requestId", requestId);
    c.set(
      "clientIp",
      resolveClientIp({
        peerAddress: options.getPeerAddress(c),
        forwardedFor: c.req.header("x-forwarded-for"),
        trustedProxies: options.trustedProxies,
      }),
    );
    await next();
    c.header(REQUEST_ID_HEADER, requestId);
  });

  app.get(HEALTH_PATH, (c) => c.json({ status: "ok" }));

  app.on(["GET", "POST"], `${AUTH_PREFIX}/*`, async (c) => {
    const response = await options.auth.handler(
      requestWithTrustedIp(c.req.raw, c.get("clientIp")),
    );
    return withRequestId(response, c.get("requestId"));
  });

  app.use(`${RPC_PREFIX}/*`, async (c) => {
    const context = await buildTransportContext(c, options.auth);
    const result = await rpcHandler.handle(c.req.raw, {
      prefix: RPC_PREFIX,
      context,
    });
    if (result.matched) {
      return withRequestId(result.response, c.get("requestId"));
    }
    return c.json({ message: "Not found." }, 404);
  });

  app.use(`${REST_PREFIX}/*`, async (c) => {
    const context = await buildTransportContext(c, options.auth);
    const result = await openApiHandler.handle(c.req.raw, {
      prefix: REST_PREFIX,
      context,
    });
    if (result.matched) {
      return withRequestId(result.response, c.get("requestId"));
    }
    return c.json({ message: "Not found." }, 404);
  });

  return app;
}
