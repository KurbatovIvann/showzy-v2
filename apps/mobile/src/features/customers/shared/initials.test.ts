import { describe, expect, it } from "vitest";

import { customerInitials } from "./initials";

describe("customerInitials", () => {
  it("takes up to two letters from the first two words", () => {
    expect(customerInitials("Марія Коваль")).toBe("МК");
    expect(customerInitials("Олег")).toBe("О");
    expect(customerInitials("  anna  maria  petrenko ")).toBe("AM");
  });

  it("uses an em dash when the name is blank", () => {
    expect(customerInitials("")).toBe("—");
    expect(customerInitials("   ")).toBe("—");
  });
});
