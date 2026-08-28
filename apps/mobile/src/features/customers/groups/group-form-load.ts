/**
 * Create/edit group form load classification (SHO-181).
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { GroupFormMode } from "./group-form-draft";

export type GroupFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyGroupFormLoad(args: {
  readonly mode: GroupFormMode;
  readonly canWrite: boolean;
  readonly groupId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): GroupFormLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  if (args.groupId === null) {
    return { kind: "not-found" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
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
  return { kind: "ready" };
}
