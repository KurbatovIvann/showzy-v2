/**
 * Pane collapse follows the panel **shell** width (ResizeObserver), not the
 * browser viewport (`docs/design/mapping/web-panel-chrome.md` Pattern lock).
 */
export const PANEL_TABLET_MIN_WIDTH = 768;
export const PANEL_DESKTOP_MIN_WIDTH = 1024;

export type PanelShellMode = "phone" | "tablet" | "desktop";

export function panelShellModeFromWidth(width: number): PanelShellMode | null {
  if (width <= 0) {
    return null;
  }
  if (width >= PANEL_DESKTOP_MIN_WIDTH) {
    return "desktop";
  }
  if (width >= PANEL_TABLET_MIN_WIDTH) {
    return "tablet";
  }
  return "phone";
}
