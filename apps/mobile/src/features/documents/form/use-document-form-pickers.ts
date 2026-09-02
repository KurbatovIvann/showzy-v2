/**
 * Order / counterparty sheet chrome (SHO-238). Composer stays RHF +
 * save + leave; handover I/O lives in `use-document-form-handover`.
 */
import { useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { DocumentFormDraft } from "./document-form-draft";

export function useDocumentFormPickers(args: {
  readonly counterpartyEnabled: boolean;
  readonly setValue: UseFormSetValue<DocumentFormDraft>;
  readonly onFieldEdit: () => void;
}) {
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [counterpartySheetOpen, setCounterpartySheetOpen] = useState(false);

  return {
    orderSheetOpen,
    counterpartySheetOpen,
    sheetOpen: orderSheetOpen || counterpartySheetOpen,
    closeSheets: () => {
      setOrderSheetOpen(false);
      setCounterpartySheetOpen(false);
    },
    openOrderSheet: () => {
      setCounterpartySheetOpen(false);
      setOrderSheetOpen(true);
    },
    openCounterpartySheet: () => {
      if (!args.counterpartyEnabled) {
        return;
      }
      setOrderSheetOpen(false);
      setCounterpartySheetOpen(true);
    },
    closeOrderSheet: () => {
      setOrderSheetOpen(false);
    },
    closeCounterpartySheet: () => {
      setCounterpartySheetOpen(false);
    },
    pickOrder: (id: string) => {
      args.setValue("orderId", id, { shouldDirty: true });
      args.setValue("counterpartyId", "", { shouldDirty: true });
      setOrderSheetOpen(false);
      args.onFieldEdit();
    },
    pickCounterparty: (id: string | null) => {
      args.setValue("counterpartyId", id ?? "", { shouldDirty: true });
      setCounterpartySheetOpen(false);
      args.onFieldEdit();
    },
    setType: (next: DocumentFormDraft["type"]) => {
      args.setValue("type", next, { shouldDirty: true });
      if (next !== "delivery_note") {
        args.setValue("basis", "", { shouldDirty: true });
      }
      args.onFieldEdit();
    },
    pickLayout: (key: string) => {
      args.setValue("layoutKey", key, { shouldDirty: true });
      args.onFieldEdit();
    },
  };
}
