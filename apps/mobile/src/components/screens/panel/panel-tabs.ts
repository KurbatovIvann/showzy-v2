/**
 * Staff panel tab descriptors. Pure TypeScript so the canvas tab order
 * stays testable without the React Native runtime.
 *
 * Canvas product lock (mp-to-mobile.md): Замовлення · Товари · AI (center)
 * · Клієнти · Ще. The `more` tab lands in ui-shell-T2; until then only the
 * first four routes exist.
 */

export type PanelTab = "orders" | "products" | "ai" | "customers";

export const panelTabOrder: readonly PanelTab[] = [
  "orders",
  "products",
  "ai",
  "customers",
];

export function isPanelTab(routeName: string): routeName is PanelTab {
  return (panelTabOrder as readonly string[]).includes(routeName);
}

/**
 * Maps the navigator's registered route names onto the canvas order,
 * dropping non-tab routes (e.g. future detail screens registered on the
 * same navigator by mistake would never reach the tab bar).
 */
export function orderedPanelTabs(
  routeNames: readonly string[],
): readonly PanelTab[] {
  return panelTabOrder.filter((tab) => routeNames.includes(tab));
}
