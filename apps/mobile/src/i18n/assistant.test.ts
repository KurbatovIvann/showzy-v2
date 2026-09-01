import { describe, expect, it } from "vitest";

import { assistantCopy } from "./assistant";
import { detectLocale } from "./locale";
import { panelCopy } from "./panel";

describe("assistant copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(assistantCopy(detectLocale()).sheetTitle).toBe("Шозік");
    expect(assistantCopy(detectLocale("en-US")).sheetTitle).toBe("Shozik");
  });

  it("keeps uk/en key parity across the namespace", () => {
    const uk = assistantCopy("uk");
    const en = assistantCopy("en");
    expect(Object.keys(uk)).toEqual(Object.keys(en));
    expect(Object.keys(uk.errors)).toEqual(Object.keys(en.errors));
  });

  it("pins sheet title Шозік/Shozik and keeps the BottomNav label AI", () => {
    const uk = assistantCopy("uk");
    const en = assistantCopy("en");
    expect(uk.sheetTitle).toBe("Шозік");
    expect(en.sheetTitle).toBe("Shozik");
    expect(panelCopy("uk").tabs.ai).toBe("AI");
    expect(panelCopy("en").tabs.ai).toBe("AI");
  });
});
