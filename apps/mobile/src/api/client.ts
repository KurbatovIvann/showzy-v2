/**
 * App wrapper around `createContractClient` (contract.md §3).
 *
 * Expo supplies `getCookie` from `@better-auth/expo`. Bearer remains
 * optional for non-RN callers. The company selector is never an access
 * grant (ADR-0013).
 */
import type { AnyContractRouter } from "@orpc/contract";
import {
  contractRouter,
  createContractClient,
  type AccessTokenProvider,
  type ContractCallContext,
  type ContractClient,
  type ContractClientOptions,
  type CookieProvider,
} from "@showzy/contract";

export interface ShowzyClientOptions {
  readonly apiUrl: string;
  readonly getCookie?: CookieProvider;
  readonly getAccessToken?: AccessTokenProvider;
  readonly fetch?: ContractClientOptions["fetch"];
  readonly initialCompanyId?: string | null;
}

export function toContractClientOptions(
  options: ShowzyClientOptions,
): ContractClientOptions {
  return {
    baseUrl: options.apiUrl,
    ...(options.getCookie === undefined
      ? {}
      : { getCookie: options.getCookie }),
    ...(options.getAccessToken === undefined
      ? {}
      : { getAccessToken: options.getAccessToken }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.initialCompanyId === undefined
      ? {}
      : { initialCompanyId: options.initialCompanyId }),
  };
}

export function createShowzyClient<
  TRouter extends AnyContractRouter = typeof contractRouter,
>(options: ShowzyClientOptions): ContractClient<TRouter> {
  return createContractClient<TRouter>(toContractClientOptions(options));
}

export type {
  AccessTokenProvider,
  ContractCallContext,
  ContractClient,
  CookieProvider,
};
