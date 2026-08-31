/**
 * Panel wrapper around `createContractClient` (contract.md §3, ADR-0030).
 *
 * Session cookies are HttpOnly, so the web client cannot attach a `Cookie`
 * header the way Expo does. The factory always uses `credentials: "omit"`
 * (so a manual Cookie is not overwritten). This adapter rebuilds each
 * request with `credentials: "include"` so the browser sends the same-origin
 * session cookie. Never a hand-written RPC path.
 */
import {
  createContractClient,
  type ContractClient,
  type ContractClientOptions,
} from "@showzy/contract";

export type { ContractClient };

export function createShowzyClient(
  options: {
    readonly baseUrl?: string;
    readonly fetch?: ContractClientOptions["fetch"];
  } = {},
): ContractClient {
  const injected = options.fetch;
  return createContractClient({
    baseUrl: options.baseUrl ?? "",
    fetch: async (request, init, rpcOptions, path, input) => {
      const sessionRequest = await requestWithBrowserCookies(request);
      if (injected !== undefined) {
        return injected(sessionRequest, init, rpcOptions, path, input);
      }
      return fetch(sessionRequest.url, await browserFetchInit(sessionRequest));
    },
  });
}

async function requestWithBrowserCookies(request: Request): Promise<Request> {
  return new Request(request.url, await browserFetchInit(request));
}

async function browserFetchInit(request: Request): Promise<RequestInit> {
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    credentials: "include",
    signal: request.signal,
  };
  const body = await bodyOf(request);
  if (body !== undefined) {
    init.body = body;
  }
  return init;
}

async function bodyOf(request: Request): Promise<string | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }
  const body = await request.text();
  return body.length === 0 ? undefined : body;
}
