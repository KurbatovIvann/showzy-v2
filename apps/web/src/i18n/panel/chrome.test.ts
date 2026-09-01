import { describe, expect, it } from "vitest";

import { detectLocale } from "../locale";
import { panelChromeCopy } from "./chrome";

describe("panel chrome copy", () => {
  it("defaults to Ukrainian and picks English only from an en locale", () => {
    expect(detectLocale()).toBe("uk");
    expect(panelChromeCopy("uk").orders).toBe("Замовлення");
    expect(panelChromeCopy("en").orders).toBe("Orders");
    expect(panelChromeCopy("uk").signOut).toBe("Вийти");
    expect(panelChromeCopy("en").signOut).toBe("Sign out");
    expect(panelChromeCopy("uk").more).toBe("Більше");
    expect(panelChromeCopy("uk").moduleTitle).toBe("Модуль у розробці");
    expect(panelChromeCopy("uk").groupOperations).toBe("Операції");
    expect(panelChromeCopy("uk").roles.owner).toBe("Власник");
  });
});
