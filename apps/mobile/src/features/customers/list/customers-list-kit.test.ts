import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("CRM lists adopt one-surface chrome", () => {
  it("keeps TabView plus scroll SegmentedTabs and wraps every pane in ListSurface", () => {
    const home = read("./customers-home-view.tsx");
    const clients = read("./clients-list-pane.tsx");
    const groups = read("../groups/groups-list-pane.tsx");
    const counterparties = read(
      "../counterparties/counterparties-list-pane.tsx",
    );
    const invitations = read("../invitations/invitations-list-pane.tsx");
    const entity = read("../shared/entity-card.tsx");

    expect(home).toContain("TabView");
    expect(home).toContain('layout="scroll"');
    expect(home).toContain("scrollableTabs");
    expect(clients).toContain("ListSurface");
    expect(clients).toContain("<ListRow first={index === 0}>");
    expect(clients).not.toContain("ItemSeparatorComponent");
    expect(groups).toContain("ListSurface");
    expect(groups).toContain("<ListRow first={index === 0}>");
    expect(groups).not.toContain("ItemSeparatorComponent");
    expect(counterparties).toContain("ListSurface");
    expect(counterparties).toContain("<ListRow first={index === 0}>");
    expect(counterparties).not.toContain("ItemSeparatorComponent");
    expect(invitations).toContain("ListSurface");
    expect(invitations).toContain("<ListRow first={index === 0}>");
    expect(invitations).not.toContain("ItemSeparatorComponent");
    expect(entity).toContain("styles.body");
    expect(entity).not.toContain("theme.shadows.sm");
    expect(entity).not.toContain("borderRadius: theme.radii.xl");
  });
});
