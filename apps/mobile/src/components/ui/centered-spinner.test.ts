import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("CenteredSpinner guard layouts", () => {
  it("replaces duplicated ActivityIndicator blocks in auth and app shells", () => {
    const auth = readFileSync(
      new URL("../../app/(auth)/_layout.tsx", import.meta.url),
      "utf8",
    );
    const app = readFileSync(
      new URL("../../app/(app)/_layout.tsx", import.meta.url),
      "utf8",
    );
    expect(auth).toContain("<CenteredSpinner");
    expect(app).toContain("<CenteredSpinner");
    expect(auth).not.toContain("ActivityIndicator");
    expect(app).not.toContain("ActivityIndicator");
  });
});
