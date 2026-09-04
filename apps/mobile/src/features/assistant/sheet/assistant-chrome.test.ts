import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  assistantComposerSendVisible,
  assistantShozikPose,
  SHOZIK_EMPTY_POSE_SIZE,
  SHOZIK_HEADER_POSE_SIZE,
} from "./assistant-chrome";

const sheetView = readFileSync(
  new URL("./assistant-sheet-view.tsx", import.meta.url),
  "utf8",
);
const composer = readFileSync(
  new URL("./assistant-composer.tsx", import.meta.url),
  "utf8",
);
const poseMark = readFileSync(
  new URL("./shozik-pose-mark.tsx", import.meta.url),
  "utf8",
);
const i18n = readFileSync(
  new URL("../../../i18n/assistant.ts", import.meta.url),
  "utf8",
);
const listCard = readFileSync(
  new URL("./orders-list-result-card.tsx", import.meta.url),
  "utf8",
);
const aggregateCard = readFileSync(
  new URL("./orders-aggregate-result-card.tsx", import.meta.url),
  "utf8",
);
const entityCard = readFileSync(
  new URL("./order-entity-card.tsx", import.meta.url),
  "utf8",
);

describe("assistantShozikPose", () => {
  it("sits when idle", () => {
    expect(
      assistantShozikPose({ thinking: false, hasInFlightTools: false }),
    ).toBe("sit");
  });

  it("digs while thinking or tools are in flight", () => {
    expect(
      assistantShozikPose({ thinking: true, hasInFlightTools: false }),
    ).toBe("dig");
    expect(
      assistantShozikPose({ thinking: false, hasInFlightTools: true }),
    ).toBe("dig");
    expect(
      assistantShozikPose({ thinking: true, hasInFlightTools: true }),
    ).toBe("dig");
  });
});

describe("assistantComposerSendVisible", () => {
  it("hides send when the field is empty or whitespace", () => {
    expect(assistantComposerSendVisible("")).toBe(false);
    expect(assistantComposerSendVisible("   ")).toBe(false);
  });

  it("shows send when there is text", () => {
    expect(assistantComposerSendVisible("покажи замовлення")).toBe(true);
  });
});

describe("assistant conversation chrome (SHO-392)", () => {
  it("puts local sit/dig in the header and first-run empty, not Sparkles", () => {
    expect(sheetView).toContain("ShozikPoseMark");
    expect(sheetView).toContain("assistantShozikPose");
    expect(sheetView).toContain("SHOZIK_HEADER_POSE_SIZE");
    expect(sheetView).toContain("SHOZIK_EMPTY_POSE_SIZE");
    expect(sheetView).toContain('pose="sit"');
    expect(sheetView).not.toContain("SparklesIcon");
    expect(sheetView).not.toContain("listen.svg");
    expect(poseMark).toContain("sit.svg");
    expect(poseMark).toContain("dig.svg");
    expect(poseMark).not.toContain("listen.svg");
    expect(poseMark).not.toContain("magicpatterns");
    expect(SHOZIK_HEADER_POSE_SIZE).toBe(40);
    expect(SHOZIK_EMPTY_POSE_SIZE).toBe(72);
  });

  it("hides the send control until there is text", () => {
    expect(composer).toContain("assistantComposerSendVisible");
    expect(composer).toContain("showSend ?");
    expect(composer).not.toContain("MicIcon");
    expect(composer).not.toContain("AudioLinesIcon");
  });

  it("does not invent first-run suggestion chips", () => {
    expect(i18n).not.toContain("chips");
    expect(i18n).not.toContain("suggestion");
    expect(sheetView).not.toContain("sendText");
    expect(sheetView).not.toContain("chips.map");
  });

  it("does not put Shozik assets on SHO-383 result cards", () => {
    expect(listCard).not.toContain("sit.svg");
    expect(listCard).not.toContain("dig.svg");
    expect(aggregateCard).not.toContain("sit.svg");
    expect(aggregateCard).not.toContain("dig.svg");
    expect(entityCard).not.toContain("sit.svg");
    expect(entityCard).not.toContain("dig.svg");
  });
});
