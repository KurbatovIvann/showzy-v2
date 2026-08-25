/**
 * `files.getDownloadUrl` read binding (SHO-137). Signed URLs are
 * short-lived and live only in the in-memory query cache — never in
 * device prefs or any persisted store. `staleTime` tracks `expiresAt`
 * so a re-observed row refetches a fresh URL instead of rendering a
 * dead one.
 */
import type { ContractClient } from "./client";
import { contractQueryOptions } from "./query-options";

export const GET_DOWNLOAD_URL_ACTION = "files.getDownloadUrl";

type ShowzyClient = ContractClient;
export type DownloadUrlOutput = Awaited<
  ReturnType<ShowzyClient["client"]["files"]["getDownloadUrl"]>
>;

/** Refetch this long before the signed URL actually expires. */
export const DOWNLOAD_URL_EXPIRY_MARGIN_MS = 30_000;

export function downloadUrlStaleTimeMs(
  data: Pick<DownloadUrlOutput, "expiresAt"> | undefined,
  nowMs: number,
): number {
  if (data === undefined) {
    return 0;
  }
  const expiresAtMs = Date.parse(data.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }
  return Math.max(0, expiresAtMs - nowMs - DOWNLOAD_URL_EXPIRY_MARGIN_MS);
}

export function fileDownloadUrlQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly fileId: string;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractQueryOptions({
      actionName: GET_DOWNLOAD_URL_ACTION,
      companyId: args.companyId,
      input: { fileId: args.fileId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.files.getDownloadUrl({ fileId: args.fileId });
      },
    }),
    staleTime: (query: {
      readonly state: { readonly data: DownloadUrlOutput | undefined };
    }) => downloadUrlStaleTimeMs(query.state.data, Date.now()),
    enabled: client !== null && args.companyId !== null,
  };
}
