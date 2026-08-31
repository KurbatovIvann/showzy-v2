import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("FormTextField", () => {
  it("forwards optional TextField chrome props with exactOptionalPropertyTypes spreads", () => {
    const source = readFileSync(
      new URL("./form-text-field.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("readonly leading?: ReactNode");
    expect(source).toContain("readonly prefix?: string");
    expect(source).toContain("readonly suffix?: string");
    expect(source).toContain('readonly size?: "default" | "lg"');
    expect(source).toContain(
      "{...(props.leading !== undefined ? { leading: props.leading } : {})}",
    );
    expect(source).toContain(
      "{...(props.prefix !== undefined ? { prefix: props.prefix } : {})}",
    );
    expect(source).toContain(
      "{...(props.suffix !== undefined ? { suffix: props.suffix } : {})}",
    );
    expect(source).toContain(
      "{...(props.size !== undefined ? { size: props.size } : {})}",
    );
  });
});
