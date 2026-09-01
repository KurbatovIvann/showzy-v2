export function listPaneClass(visibleOnNarrow: boolean): string {
  return [
    "pane-list h-full min-h-0 min-w-0 flex-col bg-surface",
    visibleOnNarrow ? "" : "pane-hide-narrow",
  ]
    .filter((part) => part !== "")
    .join(" ");
}

export function detailPaneClass(visibleOnNarrow: boolean): string {
  return [
    "pane-detail relative h-full min-h-0 min-w-0 flex-1 flex-col bg-canvas",
    visibleOnNarrow ? "" : "pane-hide-narrow",
  ]
    .filter((part) => part !== "")
    .join(" ");
}
