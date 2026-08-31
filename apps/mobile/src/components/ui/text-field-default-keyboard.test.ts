import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  TEXT_FIELD_DEFAULT_KEYBOARD_TYPE,
  resolveTextFieldContent,
} from "./text-field-content";

const TEXT_FIELD = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "text-field.tsx"),
  "utf8",
);

describe("TextField default keyboard", () => {
  it("is default, not email-address", () => {
    expect(TEXT_FIELD_DEFAULT_KEYBOARD_TYPE).toBe("default");
    expect(TEXT_FIELD).toContain(
      "const keyboardType = props.keyboardType ?? TEXT_FIELD_DEFAULT_KEYBOARD_TYPE",
    );
    expect(TEXT_FIELD).not.toContain('?? "email-address"');
  });

  it("does not opt into email autocomplete on the default keyboard", () => {
    expect(
      resolveTextFieldContent({
        secure: false,
        keyboardType: TEXT_FIELD_DEFAULT_KEYBOARD_TYPE,
      }),
    ).toEqual({ autoComplete: "off", textContentType: "none" });
  });
});
