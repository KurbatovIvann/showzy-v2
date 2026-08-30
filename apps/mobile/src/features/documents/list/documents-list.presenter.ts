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

export type DocumentsFilteredEmptyView = {
  readonly showReset: boolean;
  readonly description: string;
};

/**
 * Type chips are local state; `orderId` is a route query. Reset never
 * pretends a type-only `setType("all")` will clear an order-scoped list.
 */
export function documentsFilteredEmptyView(args: {
  readonly type: DocumentsTypeFilter;
  readonly orderId: string | null;
  readonly copy: DocumentsCopy;
}): DocumentsFilteredEmptyView {
  const hasType = args.type !== "all";
  const hasOrder = args.orderId !== null;
  if (hasType && hasOrder) {
    return {
      showReset: true,
      description: args.copy.empty.filteredTypeAndOrderDescription,
    };
  }
  if (hasType) {
    return {
      showReset: true,
      description: args.copy.empty.filteredDescription,
    };
  }
  if (hasOrder) {
    return {
      showReset: true,
      description: args.copy.empty.filteredOrderDescription,
    };
  }
  return {
    showReset: false,
    description: args.copy.empty.filteredDescription,
  };
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

export type DocumentsListRow = {
  readonly id: string;
  readonly documentNumber: string;
  readonly typeLabel: string;
  readonly buyerLabel: string;
  readonly issuedOnLabel: string;
  readonly totalLabel: string;
  readonly cancelled: boolean;
  readonly status: DocumentStatus;
  readonly optionsA11y: string;
  readonly showSign: boolean;
  readonly showSignedChip: boolean;
};

export type DocumentOptionsGetLoadState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "ready" };

/**
 * Options-sheet `documents.get` — same split as `classifyProductDetail`.
 * Query failure is not generation pending / not-ready PDF.
 */
export function classifyDocumentOptionsGet(args: {
  readonly documentId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): DocumentOptionsGetLoadState {
  if (args.documentId === null) {
    return { kind: "idle" };
  }
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
  return { kind: "ready" };
}

export type DocumentSigningStatus = "unsigned" | "pending" | "supplier_signed";

export type DocumentOptionVisibility = {
  readonly showShare: boolean;
  readonly showQr: boolean;
  readonly showPrint: boolean;
  readonly showOpenPdf: boolean;
  readonly showSign: boolean;
  readonly showCancel: boolean;
  readonly pdfReady: boolean;
  readonly openPdfEnabled: boolean;
  readonly signingChip: DocumentSigningStatus | null;
};

export function documentListSignVisibility(args: {
  readonly canEdit: boolean;
  readonly status: DocumentStatus;
  readonly supplierSigned: boolean;
}): { readonly showSign: boolean; readonly showSignedChip: boolean } {
  return {
    showSign: args.canEdit && args.status === "issued" && !args.supplierSigned,
    showSignedChip: args.supplierSigned,
  };
}

export function canOpenSigningFromRow(args: {
  readonly showSign: boolean;
  readonly signingSheetOpen: boolean;
}): boolean {
  return args.showSign && !args.signingSheetOpen;
}

export function documentOptionVisibility(args: {
  readonly canView: boolean;
  readonly canEdit: boolean;
  readonly status: DocumentStatus;
  readonly getLoad: DocumentOptionsGetLoadState["kind"];
  readonly generationStatus: "pending" | "ready" | "failed" | null;
  readonly pdfDownloadUrl: string | null;
  readonly supplierSigned: boolean;
  readonly signingStatus: DocumentSigningStatus | null;
}): DocumentOptionVisibility {
  const pdfReady =
    args.getLoad === "ready" &&
    args.generationStatus === "ready" &&
    args.pdfDownloadUrl !== null;
  const getFailed = args.getLoad === "error" || args.getLoad === "offline";
  const signed =
    args.signingStatus === "supplier_signed" ||
    (args.signingStatus === null && args.supplierSigned);
  const signingChip =
    args.getLoad === "ready" &&
    (args.signingStatus === "supplier_signed" ||
      args.signingStatus === "pending")
      ? args.signingStatus
      : null;
  return {
    showShare: args.canEdit,
    showQr: args.canEdit,
    showPrint: args.canEdit,
    showOpenPdf: args.canView,
    showSign: args.canEdit && args.status === "issued" && !signed,
    showCancel: args.canEdit && args.status === "issued",
    pdfReady,
    openPdfEnabled: args.canView && (pdfReady || getFailed),
    signingChip,
  };
}
