import { describe, expect, it } from "vitest";

import { contractModules, contractRouter } from "./modules.js";

describe("empty composition (no domain modules yet)", () => {
  it("exposes an empty record so an exposure decision cannot be skipped silently", () => {
    expect(contractModules).toEqual({});
    expect(contractRouter).toEqual({});
  });
});
