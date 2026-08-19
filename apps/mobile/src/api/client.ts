/**
 * App wrapper around `createContractClient` (contract.md §3).
 *
 * `getAccessToken` reads the bearer from the session controller (fnd-T49).
 * The company selector is never an access grant (ADR-0013).
 */
import type { AnyContractRouter } from "@orpc/contract";
import {
  contractRouter,
  createContractClient,
  type AccessTokenProvider,
  type ContractCallContext,
  type ContractClient,
  type ContractClientOptions,
} from "@showzy/contract";

export interface ShowzyClientOptions {
  readonly apiUrl: string;
  readonly getAccessToken?: AccessTokenProvider;
  readonly fetch?: ContractClientOptions["fetch"];
  readonly initialCompanyId?: string | null;
}

export function toContractClientOptions(
  options: ShowzyClientOptions,
): ContractClientOptions {
  return {
    baseUrl: options.apiUrl,
    getAccessToken: options.getAccessToken ?? ((): null => null),
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

export type { AccessTokenProvider, ContractCallContext, ContractClient };
