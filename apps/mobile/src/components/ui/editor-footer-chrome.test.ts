import { describe, expect, it } from "vitest";

import { editorFooterChrome } from "./editor-footer-chrome";

describe("editorFooterChrome", () => {
  it("shows the empty line and hides meta, hint, and leading", () => {
    expect(
      editorFooterChrome({
        empty: true,
        emptyLabel: "Без позицій",
        metaLabel: "1 позиція",
        hint: "Hint",
        leading: true,
      }),
    ).toEqual({
      showEmpty: true,
      showMeta: false,
      showHint: false,
      showLeading: false,
    });
  });

  it("shows meta when not empty, and hides hint and leading", () => {
    expect(
      editorFooterChrome({
        empty: false,
        metaLabel: "Базова ціна",
        hint: "Hint",
        leading: true,
      }),
    ).toEqual({
      showEmpty: false,
      showMeta: true,
      showHint: false,
      showLeading: false,
    });
  });

  it("shows hint only when empty and meta are absent", () => {
    expect(editorFooterChrome({ hint: "Hint" })).toEqual({
      showEmpty: false,
      showMeta: false,
      showHint: true,
      showLeading: false,
    });
  });

  it("shows leading only when typed slots are unused", () => {
    expect(editorFooterChrome({ leading: true })).toEqual({
      showEmpty: false,
      showMeta: false,
      showHint: false,
      showLeading: true,
    });
  });

  it("ignores empty without a label", () => {
    expect(editorFooterChrome({ empty: true })).toEqual({
      showEmpty: false,
      showMeta: false,
      showHint: false,
      showLeading: false,
    });
  });
});
