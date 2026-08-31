import { archiveProduct } from "./actions/archive-product.js";
import { archiveVariant } from "./actions/archive-variant.js";
import { createProduct } from "./actions/create-product.js";
import { createVariant } from "./actions/create-variant.js";
import { getProduct } from "./actions/get-product.js";
import { getProductOrderFacts } from "./actions/get-product-order-facts.js";
import { getProductPricingFacts } from "./actions/get-product-pricing-facts.js";
import { listProducts } from "./actions/list-products.js";
import { restoreProduct } from "./actions/restore-product.js";
import { restoreVariant } from "./actions/restore-variant.js";
import { setProductImages } from "./actions/set-product-images.js";
import { updateProduct } from "./actions/update-product.js";
import { updateVariant } from "./actions/update-variant.js";

export { archiveProduct };
export { archiveVariant };
export { createProduct };
export { createVariant };
export { getProduct };
export { getProductOrderFacts };
export { getProductPricingFacts };
export { listProducts };
export { restoreProduct };
export { restoreVariant };
export { setProductImages };
export { updateProduct };
export { updateVariant };

export const catalogActions = [
  createProduct,
  createVariant,
  getProduct,
  getProductOrderFacts,
  getProductPricingFacts,
  listProducts,
  updateProduct,
  updateVariant,
  archiveProduct,
  restoreProduct,
  archiveVariant,
  restoreVariant,
  setProductImages,
] as const;
