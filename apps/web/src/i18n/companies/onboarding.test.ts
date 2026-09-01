import { describe, expect, it } from "vitest";

import { detectLocale } from "../locale";
import { onboardingCopy, slugPreviewCopy, stepLabelCopy } from "./onboarding";

describe("onboarding copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(detectLocale()).toBe("uk");
    expect(onboardingCopy("uk").companyTitle).toBe("Про ваш бізнес");
    expect(onboardingCopy("en").companyTitle).toBe("About your business");
    expect(onboardingCopy("uk").legalSkip).toBe(
      "Заповнити пізніше в налаштуваннях",
    );
    expect(onboardingCopy("uk").typeTov).toBe("ТОВ");
    expect(onboardingCopy("en").typeTov).toBe("LLC");
  });

  it("builds the live slug preview without treating the slug as copy", () => {
    const uk = onboardingCopy("uk");
    expect(slugPreviewCopy(uk, "")).toBe("shozee.com.ua/…");
    expect(slugPreviewCopy(uk, "torta-marii")).toBe(
      "shozee.com.ua/torta-marii",
    );
    expect(stepLabelCopy(uk, 1, 2)).toBe("Крок 1 з 2");
  });
});
