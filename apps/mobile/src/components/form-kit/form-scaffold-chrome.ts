export type FormScaffoldLoadKind =
  "loading" | "offline" | "error" | "permission" | "ready";

export type FormScaffoldBody =
  "skeleton" | "offline" | "error" | "permission" | "ready";

export function formScaffoldBody(kind: FormScaffoldLoadKind): FormScaffoldBody {
  return kind === "loading" ? "skeleton" : kind;
}

export function formScaffoldShowsFooter(args: {
  readonly loadKind: FormScaffoldLoadKind;
  readonly hasFooter: boolean;
}): boolean {
  return args.loadKind === "ready" && args.hasFooter;
}

export function formScaffoldShowsRetry(kind: FormScaffoldLoadKind): boolean {
  return kind === "offline" || kind === "error";
}
