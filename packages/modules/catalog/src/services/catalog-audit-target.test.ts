import { describe, expect, it } from "vitest";

import {
  productAuditTarget as archiveProductAuditTarget,
  variantAuditTarget as archiveVariantAuditTarget,
} from "./catalog-audit-target.js";
import { productAuditTarget } from "./product-audit-target.js";
import { variantAuditTarget } from "./variant-audit-target.js";

const variantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("catalog audit target types", () => {
  it("audits variants as variant, never product_variant", () => {
    const env = { input: { variantId } };
    expect(archiveVariantAuditTarget(env).type).toBe("variant");
    expect(variantAuditTarget(env).type).toBe("variant");
    expect(archiveVariantAuditTarget(env).type).not.toBe("product_variant");
    expect(variantAuditTarget(env).type).not.toBe("product_variant");
    expect(archiveVariantAuditTarget(env).id).toBe(variantId);
    expect(variantAuditTarget({ output: { variantId }, input: {} }).id).toBe(
      variantId,
    );
  });

  it("keeps product targets as product", () => {
    const env = { input: { productId } };
    expect(archiveProductAuditTarget(env).type).toBe("product");
    expect(productAuditTarget(env).type).toBe("product");
    expect(archiveProductAuditTarget(env).id).toBe(productId);
  });
});
