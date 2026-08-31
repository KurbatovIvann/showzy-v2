import { z } from "zod";

/**
 * Same cap as `companies.create` (golden write). Catalog product and
 * variant names share it; company name schemas stay in `companies`.
 */
export const PRODUCT_NAME_MAX = 120;

export const catalogNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name must not be blank." })
  .max(PRODUCT_NAME_MAX);

/** Line-item-style ceiling copied from `orders.create` (mechanical). */
export const CREATE_PRODUCT_MAX_VARIANTS = 100;

export const LIST_PRODUCTS_QUERY_MAX = 100;

/** Ticket ceiling for `catalog.setProductImages` ("max ~10"). */
export const SET_PRODUCT_IMAGES_MAX = 10;

/** MVP is UAH-only (db.md §11); the column is reserved for a later ADR. */
export const currencyCodeSchema = z.literal("UAH");

export const DEFAULT_PRODUCT_CURRENCY = "UAH";
