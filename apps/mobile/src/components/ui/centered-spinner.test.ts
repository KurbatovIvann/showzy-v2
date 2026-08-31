import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("CenteredSpinner guard layouts", () => {
  it("replaces duplicated ActivityIndicator blocks in auth and app shells", () => {
    const auth = readFileSync(
      join(SRC, "app", "(auth)", "_layout.tsx"),
      "utf8",
    );
    const app = readFileSync(join(SRC, "app", "(app)", "_layout.tsx"), "utf8");
    expect(auth).toContain("<CenteredSpinner");
    expect(app).toContain("<CenteredSpinner");
    expect(auth).not.toContain("ActivityIndicator");
    expect(app).not.toContain("ActivityIndicator");
  });
});
