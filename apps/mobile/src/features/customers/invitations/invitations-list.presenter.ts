/**
 * Pure view-model logic for the invitations list (SHO-205).
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersInviteStatusCopy } from "../../../i18n/customers";
import { interpolate, type Locale } from "../../../i18n/locale";
import type { InviteListItem } from "../api/invite.queries";
import { flattenPages, nameById } from "../shared/paged-list";

export { nameById };

export type InviteDerivedStatus = InviteListItem["status"];

export type InviteStatusTone =
  "neutral" | "action" | "success" | "attention" | "danger";

const expiryFormatters: Record<Locale, Intl.DateTimeFormat> = {
  uk: new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
};

export function formatInviteExpiry(iso: string, locale: Locale): string {
  return expiryFormatters[locale].format(new Date(iso));
}

export function inviteStatusTone(
  status: InviteDerivedStatus,
): InviteStatusTone {
  switch (status) {
    case "pending":
      return "success";
    case "expired":
    case "exhausted":
      return "attention";
    case "revoked":
      return "neutral";
  }
}

export function inviteStatusLabel(
  status: InviteDerivedStatus,
  labels: CustomersInviteStatusCopy,
): string {
  return labels[status];
}

function contactMeta(value: string | null, title: string): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0 || trimmed === title) {
    return null;
  }
  return trimmed;
}

export function inviteRowTitle(
  item: InviteListItem,
  untitled: { readonly reusable: string; readonly personal: string },
): string {
  const name = item.name?.trim() ?? "";
  if (name.length > 0) {
    return name;
  }
  const phone = item.phone?.trim() ?? "";
  if (phone.length > 0) {
    return phone;
  }
  const email = item.email?.trim() ?? "";
  if (email.length > 0) {
    return email;
  }
  return item.isReusable ? untitled.reusable : untitled.personal;
}

export type InviteRowView = {
  readonly id: string;
  readonly title: string;
  readonly status: InviteDerivedStatus;
  readonly groupName: string | null;
  readonly priceListName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly usesCount: number;
  readonly maxUses: number | null;
  readonly expiresAt: string;
};

export function toInviteRowView(
  item: InviteListItem,
  groups: ReadonlyMap<string, string>,
  priceLists: ReadonlyMap<string, string>,
  untitled: { readonly reusable: string; readonly personal: string },
): InviteRowView {
  const title = inviteRowTitle(item, untitled);
  return {
    id: item.id,
    title,
    status: item.status,
    groupName:
      item.groupId === null ? null : (groups.get(item.groupId) ?? null),
    priceListName:
      item.priceListId === null
        ? null
        : (priceLists.get(item.priceListId) ?? null),
    phone: contactMeta(item.phone, title),
    email: contactMeta(item.email, title),
    usesCount: item.usesCount,
    maxUses: item.maxUses,
    expiresAt: item.expiresAt,
  };
}

export function inviteUsesLabel(
  usesCount: number,
  maxUses: number | null,
  templates: { readonly limited: string; readonly unlimited: string },
): string {
  if (maxUses === null) {
    return interpolate(templates.unlimited, { used: String(usesCount) });
  }
  return interpolate(templates.limited, {
    used: String(usesCount),
    max: String(maxUses),
  });
}

export function inviteExpiryLabel(
  expiresAt: string,
  status: InviteDerivedStatus,
  locale: Locale,
  templates: { readonly pending: string; readonly ended: string },
): string {
  const date = formatInviteExpiry(expiresAt, locale);
  const template = status === "expired" ? templates.ended : templates.pending;
  return interpolate(template, { date });
}

export type InvitationsListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "rows" };

export function classifyInvitationsList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
}): InvitationsListState {
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    return args.failureKind === "offline"
      ? { kind: "offline" }
      : { kind: "error" };
  }
  if (args.rowCount > 0) {
    return { kind: "rows" };
  }
  return { kind: "empty-catalog" };
}

export function flattenInviteListPages(
  pages: ReadonlyArray<{ readonly items: readonly InviteListItem[] }>,
): readonly InviteListItem[] {
  return flattenPages(pages);
}

export type InviteRowActions = {
  readonly showRevoke: boolean;
};

export function inviteRowActions(args: {
  readonly status: InviteDerivedStatus;
  readonly canInvite: boolean;
}): InviteRowActions {
  return {
    showRevoke: args.canInvite && args.status === "pending",
  };
}
