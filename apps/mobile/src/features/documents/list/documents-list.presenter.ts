/**
 * Pure view-model logic for the documents list (SHO-237). No React
 * Native imports so the whole decision surface is unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import { interpolate, type Locale } from "../../../i18n/locale";
import type { DocumentsCopy } from "../../../i18n/documents";
import type {
  DocumentListItem,
  DocumentsTypeFilter,
  ListDocumentsPageInput,
} from "../api/document.queries";
import { formatIssuedOn } from "../shared/format-issued-on";

export type { DocumentsTypeFilter };

export const DOCUMENT_TYPE_FILTERS: readonly DocumentsTypeFilter[] = [
  "all",
  "payment_invoice",
  "delivery_note",
];

export function flattenDocumentPages(
  pages: ReadonlyArray<{ readonly items: readonly DocumentListItem[] }>,
): readonly DocumentListItem[] {
  return pages.flatMap((page) => page.items);
}

export function listDocumentsPageInput(
  type: DocumentsTypeFilter,
  orderId: string | null,
): ListDocumentsPageInput {
  return {
    type,
    ...(orderId === null ? {} : { orderId }),
  };
}

export function hasDocumentsListFilter(args: {
  readonly type: DocumentsTypeFilter;
  readonly orderId: string | null;
}): boolean {
  return args.type !== "all" || args.orderId !== null;
}

export type DocumentStatus = DocumentListItem["status"];

export function isCancelledStatus(status: DocumentStatus): boolean {
  return status === "cancelled";
}

export type DocumentRowView = {
  readonly id: string;
  readonly documentNumber: string;
  readonly type: DocumentListItem["type"];
  readonly typeLabel: string;
  readonly buyerLabel: string;
  readonly issuedOnLabel: string;
  readonly totalLabel: string;
  readonly cancelled: boolean;
  readonly status: DocumentStatus;
  readonly optionsA11y: string;
};

export function toDocumentRowView(
  item: DocumentListItem,
  args: {
    readonly locale: Locale;
    readonly copy: DocumentsCopy;
  },
): DocumentRowView {
  return {
    id: item.documentId,
    documentNumber: item.documentNumber,
    type: item.type,
    typeLabel: args.copy.types[item.type],
    buyerLabel: item.buyerLabel,
    issuedOnLabel: formatIssuedOn(item.issuedOn, args.locale),
    totalLabel: formatMoneyMinor(item.totalGrossMinor, item.currency),
    cancelled: isCancelledStatus(item.status),
    status: item.status,
    optionsA11y: interpolate(args.copy.optionsLabel, {
      number: item.documentNumber,
    }),
  };
}

export type DocumentsListState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "empty-filtered" }
  | { readonly kind: "empty-catalog" }
  | { readonly kind: "rows" };

/**
 * Canvas state machine without search: skeletons while loading, offline
 * vs error, then type/order filtered-empty vs catalog-empty.
 */
export function classifyDocumentsList(args: {
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly rowCount: number;
  readonly type: DocumentsTypeFilter;
  readonly orderId: string | null;
}): DocumentsListState {
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
  if (hasDocumentsListFilter({ type: args.type, orderId: args.orderId })) {
    return { kind: "empty-filtered" };
  }
  return { kind: "empty-catalog" };
}

export type DocumentsHeaderActions = {
  readonly showCreate: boolean;
};

export function documentsHeaderActions(args: {
  readonly canCreate: boolean;
}): DocumentsHeaderActions {
  return { showCreate: args.canCreate };
}

export type DocumentOptionVisibility = {
  readonly showShare: boolean;
  readonly showQr: boolean;
  readonly showPrint: boolean;
  readonly showOpenPdf: boolean;
  readonly showCancel: boolean;
  readonly pdfReady: boolean;
};

export function documentOptionVisibility(args: {
  readonly canView: boolean;
  readonly canEdit: boolean;
  readonly status: DocumentStatus;
  readonly generationStatus: "pending" | "ready" | "failed" | null;
  readonly pdfDownloadUrl: string | null;
}): DocumentOptionVisibility {
  const pdfReady =
    args.generationStatus === "ready" && args.pdfDownloadUrl !== null;
  return {
    showShare: args.canEdit,
    showQr: args.canEdit,
    showPrint: args.canEdit,
    showOpenPdf: args.canView,
    showCancel: args.canEdit && args.status === "issued",
    pdfReady,
  };
}
