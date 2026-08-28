import { randomUUID } from "node:crypto";

import { slugifyUk } from "@showzy/validation/slug";

import { GROUP_SLUG_MAX } from "../actions/group-view.contract.js";

export const GROUP_SLUG_SHORT_ID_LENGTH = 8;
export const GROUP_SLUG_FALLBACK_PREFIX = "group-";
export const CUSTOMER_GROUPS_COMPANY_SLUG_UQ =
  "customer_groups_company_slug_uq";

/**
 * Latin slug from a trimmed group name, or `undefined` when nothing
 * usable remains (punctuation-only / combining-mark-only names). The
 * caller then stores `group-{shortid}`. Alphabet lives in
 * `@showzy/validation/slug`.
 */
export function slugFromName(name: string): string | undefined {
  const slug = slugifyUk(name, { max: GROUP_SLUG_MAX });
  return slug.length === 0 ? undefined : slug;
}

/** `group-` plus 8 hex chars from a v4 UUID. Unique enough to retry on 23505. */
export function groupFallbackSlug(): string {
  return `${GROUP_SLUG_FALLBACK_PREFIX}${randomUUID()
    .replaceAll("-", "")
    .slice(0, GROUP_SLUG_SHORT_ID_LENGTH)}`;
}

export function isGroupFallbackSlug(slug: string): boolean {
  return new RegExp(
    `^${GROUP_SLUG_FALLBACK_PREFIX}[0-9a-f]{${String(GROUP_SLUG_SHORT_ID_LENGTH)}}$`,
  ).test(slug);
}
