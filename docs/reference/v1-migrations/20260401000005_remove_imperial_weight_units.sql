-- ============================================================================
-- Migration: remove_imperial_weight_units
-- Description: Remove ounces (oz) and pounds (lb) from allowed weight units.
--              Convert existing imperial values to metric equivalents.
-- Dependencies: products (20260301000007), product_specifications (20260311000002)
-- ============================================================================

-- Convert existing imperial weight values to metric
UPDATE products SET weight_value = weight_value * 28.3495, weight_unit = 'g' WHERE weight_unit = 'oz';
UPDATE products SET weight_value = weight_value * 0.453592, weight_unit = 'kg' WHERE weight_unit = 'lb';

-- Replace constraint to only allow metric units
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_weight_unit_check;
ALTER TABLE products ADD CONSTRAINT products_weight_unit_check
	CHECK (weight_unit IS NULL OR weight_unit IN ('g', 'kg'));
