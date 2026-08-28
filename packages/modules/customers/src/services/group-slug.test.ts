import { describe, expect, it } from "vitest";

import {
  GROUP_SLUG_FALLBACK_PREFIX,
  GROUP_SLUG_SHORT_ID_LENGTH,
  groupFallbackSlug,
  isGroupFallbackSlug,
  slugFromName,
} from "./group-slug.js";

describe("group slug", () => {
  it("transliterates Latin and Ukrainian names", () => {
    expect(slugFromName("VIP")).toBe("vip");
    expect(slugFromName("Wholesale 2024")).toBe("wholesale-2024");
    expect(slugFromName("Київські торти")).toBe("kyivski-torty");
    expect(slugFromName("віп")).toBe("vip");
  });

  it("returns undefined when transliteration is empty", () => {
    expect(slugFromName("«—»!!!")).toBeUndefined();
    expect(slugFromName("...")).toBeUndefined();
  });

  it("collapses punctuation and strips combining marks' leftover hyphens", () => {
    expect(slugFromName("Кав'ярня Затишок")).toBe("kav-iarnia-zatyshok");
    expect(slugFromName("A---B")).toBe("a-b");
  });

  it("mints a group-{shortid} fallback", () => {
    const slug = groupFallbackSlug();
    expect(slug.startsWith(GROUP_SLUG_FALLBACK_PREFIX)).toBe(true);
    expect(isGroupFallbackSlug(slug)).toBe(true);
    expect(slug).toHaveLength(
      GROUP_SLUG_FALLBACK_PREFIX.length + GROUP_SLUG_SHORT_ID_LENGTH,
    );
    expect(groupFallbackSlug()).not.toBe(slug);
  });
});
