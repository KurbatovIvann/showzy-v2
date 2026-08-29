/**
 * Public `/d/[token]` load classification (SHO-238). Not a customer
 * cabinet. Download only when `pdfDownloadUrl` is a safe http(s) URL.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { isSafeHttpUrl } from "../shared/is-safe-http-url";

export type DocumentSharedLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "ready"; readonly downloadUrl: string | null };

export function classifyDocumentSharedLoad(args: {
  readonly token: string | null;
  readonly clientReady: boolean;
  readonly authLoading: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly pdfDownloadUrl: string | null;
}): DocumentSharedLoadState {
  if (args.token === null) {
    return { kind: "not-found" };
  }
  if (!args.clientReady) {
    return args.authLoading ? { kind: "loading" } : { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    if (args.failureKind === "offline") {
      return { kind: "offline" };
    }
    if (args.failureKind === "not_found") {
      return { kind: "not-found" };
    }
    return { kind: "error" };
  }
  const downloadUrl =
    args.pdfDownloadUrl !== null && isSafeHttpUrl(args.pdfDownloadUrl)
      ? args.pdfDownloadUrl
      : null;
  return { kind: "ready", downloadUrl };
}
