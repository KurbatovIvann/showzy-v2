import { describe, expect, it } from "vitest";

import {
  PANEL_DESKTOP_MIN_WIDTH,
  PANEL_TABLET_MIN_WIDTH,
  panelShellModeFromWidth,
} from "./panel-shell-mode";

describe("panelShellModeFromWidth", () => {
  it("returns null for an unmeasured shell so callers keep the previous mode", () => {
    expect(panelShellModeFromWidth(0)).toBeNull();
    expect(panelShellModeFromWidth(-1)).toBeNull();
  });

  it("maps the three locked ranges", () => {
    expect(panelShellModeFromWidth(PANEL_TABLET_MIN_WIDTH - 1)).toBe("phone");
    expect(panelShellModeFromWidth(PANEL_TABLET_MIN_WIDTH)).toBe("tablet");
    expect(panelShellModeFromWidth(PANEL_DESKTOP_MIN_WIDTH - 1)).toBe("tablet");
    expect(panelShellModeFromWidth(PANEL_DESKTOP_MIN_WIDTH)).toBe("desktop");
    expect(panelShellModeFromWidth(1440)).toBe("desktop");
  });
});
