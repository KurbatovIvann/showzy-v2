import { useRouterState } from "@tanstack/react-router";

import type { CompanySlugPath, PanelSectionId } from "./panel-section";

export type PanelPaneMode = "list" | "detail";

/**
 * Small panel fields only (SHO-328). Not a generic route-metadata
 * framework: section, list vs detail, and the typed list/back `to`.
 */
export type PanelRouteData = {
  readonly panelSection?: PanelSectionId;
  readonly pane?: PanelPaneMode;
  readonly listTo?: CompanySlugPath;
};

export type ResolvedPanelState = {
  readonly panelSection: PanelSectionId;
  readonly pane: PanelPaneMode;
  readonly listTo: CompanySlugPath;
};

export type PanelMatchInput = {
  readonly staticData: {
    readonly panel?: PanelRouteData;
  };
};

/** Detail / create / edit leaves. Layouts own section + listTo. */
export const PANEL_DETAIL = {
  panel: { pane: "detail" },
} as const satisfies { readonly panel: PanelRouteData };

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    readonly panel?: PanelRouteData;
  }
}

export function resolvePanelStateFromMatches(
  matches: ReadonlyArray<PanelMatchInput>,
): ResolvedPanelState | undefined {
  let panelSection: PanelSectionId | undefined;
  let pane: PanelPaneMode | undefined;
  let listTo: CompanySlugPath | undefined;
  for (const match of matches) {
    const panel = match.staticData.panel;
    if (panel === undefined) {
      continue;
    }
    if (panel.panelSection !== undefined) {
      panelSection = panel.panelSection;
    }
    if (panel.pane !== undefined) {
      pane = panel.pane;
    }
    if (panel.listTo !== undefined) {
      listTo = panel.listTo;
    }
  }
  if (panelSection === undefined || listTo === undefined) {
    return undefined;
  }
  return { panelSection, pane: pane ?? "list", listTo };
}

export function useResolvedPanelState(): ResolvedPanelState | undefined {
  return useRouterState({
    select: (state) => resolvePanelStateFromMatches(state.matches),
    structuralSharing: true,
  });
}

export function useRequiredPanelState(): ResolvedPanelState {
  const panel = useResolvedPanelState();
  if (panel === undefined) {
    throw new Error("Panel route is missing staticData.panel");
  }
  return panel;
}
