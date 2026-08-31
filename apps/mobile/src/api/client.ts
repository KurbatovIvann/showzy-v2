/**
 * App wrapper around `createContractClient` (contract.md §3).
 *
 * Expo supplies `getCookie` from `@better-auth/expo`. Bearer remains
 * optional for non-RN callers. The company selector is never an access
 * grant (ADR-0013).
 *
 * `onActiveCompanyChange` is the composition hook for persistence and
 * cache isolation — do not monkey-patch `setActiveCompany`.
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

export type ActiveCompanyChangeListener = (companyId: string | null) => void;

export type ShowzyClient<
  TRouter extends AnyContractRouter = typeof contractRouter,
> = ContractClient<TRouter> & {
  onActiveCompanyChange(listener: ActiveCompanyChangeListener): () => void;
};

export type ActiveCompanyListenerHost = {
  onActiveCompanyChange(listener: ActiveCompanyChangeListener): () => void;
};

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
>(options: ShowzyClientOptions): ShowzyClient<TRouter> {
  const inner = createContractClient<TRouter>(toContractClientOptions(options));
  const listeners = new Set<ActiveCompanyChangeListener>();
  return {
    client: inner.client,
    createMutationAttempt: inner.createMutationAttempt,
    getActiveCompany: () => inner.getActiveCompany(),
    setActiveCompany(companyId) {
      inner.setActiveCompany(companyId);
      for (const listener of [...listeners]) {
        listener(companyId);
      }
    },
    onActiveCompanyChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type {
  AccessTokenProvider,
  ContractCallContext,
  ContractClient,
  CookieProvider,
};
