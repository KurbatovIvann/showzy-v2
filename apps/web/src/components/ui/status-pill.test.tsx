/**
 * StatusPill primitive (SHO-311): soft tone classes per the canvas
 * status palette (`web-panel-chrome.md` §Order statuses — incl. the
 * web-only `focus` tone) and both sizes. Status is never color-only.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusPill, type StatusPillTone } from "./status-pill";

afterEach(cleanup);

const TONE_CASES: ReadonlyArray<[StatusPillTone, string, string]> = [
  ["action", "bg-actionSoft", "text-action"],
  ["focus", "bg-focusSoft", "text-focus"],
  ["attention", "bg-attentionSoft", "text-attention"],
  ["success", "bg-successSoft", "text-success"],
  ["danger", "bg-dangerSoft", "text-danger"],
  ["queued", "bg-canvas", "text-ink"],
  ["neutral", "bg-canvas", "text-muted"],
];

describe("StatusPill (SHO-311)", () => {
  it.each(TONE_CASES)(
    "renders the %s tone on its soft token pair",
    (tone, background, text) => {
      render(<StatusPill label={`Тон ${tone}`} tone={tone} />);
      const pill = screen.getByText(`Тон ${tone}`);
      expect(pill.className).toContain(background);
      expect(pill.className).toContain(text);
      expect(pill.className).toContain("rounded-full");
    },
  );

  it("always renders the label — status is never color-only", () => {
    render(<StatusPill label="Підтверджено" tone="focus" />);
    expect(screen.getByText("Підтверджено")).toBeDefined();
  });

  it("defaults to the neutral hairline capsule in the small size", () => {
    render(<StatusPill label="Без статусу" />);
    const pill = screen.getByText("Без статусу");
    expect(pill.className).toContain("border-line");
    expect(pill.className).toContain("text-[12px]");
  });

  it("scales up padding and type in the md size", () => {
    render(<StatusPill label="Нове" tone="action" size="md" />);
    expect(screen.getByText("Нове").className).toContain("text-[13px]");
  });
});
