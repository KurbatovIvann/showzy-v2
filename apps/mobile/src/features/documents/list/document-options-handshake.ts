/**
 * Options-sheet chrome and the native dismiss handshake (copy SHO-198 /
 * pricing). Close sets `visible=false` first; `documentId` stays until
 * `onHidden` so the title does not flip mid-animation. Native Alert and
 * Share run only after the RN Modal is gone.
 */
import type {
  ConfirmDialogChoice,
  ConfirmDialogRequest,
} from "../../../components/ui/confirm-dialog";

export type DocumentOptionsChrome = {
  readonly visible: boolean;
  readonly documentId: string | null;
};

export const IDLE_DOCUMENT_OPTIONS: DocumentOptionsChrome = {
  visible: false,
  documentId: null,
};

export function openDocumentOptions(documentId: string): DocumentOptionsChrome {
  return { visible: true, documentId };
}

/** Start close. Keep the selected row until `onHidden`. */
export function hideDocumentOptions(
  state: DocumentOptionsChrome,
): DocumentOptionsChrome {
  return { visible: false, documentId: state.documentId };
}

/**
 * Drop the selected row after the Modal is gone. A late `onHidden` from a
 * previous close must not clear a sheet that was reopened (`visible`).
 */
export function documentOptionsHidden(
  state: DocumentOptionsChrome,
): DocumentOptionsChrome {
  if (state.visible) {
    return state;
  }
  return IDLE_DOCUMENT_OPTIONS;
}

type OptionsSheetHiddenPorts = {
  readonly waitHidden: () => Promise<void>;
  readonly hide: () => void;
};

export async function waitThenConfirmDocumentCancel(
  args: OptionsSheetHiddenPorts & {
    readonly presentConfirmDialog: (
      request: ConfirmDialogRequest,
    ) => Promise<ConfirmDialogChoice>;
    readonly confirm: ConfirmDialogRequest;
  },
): Promise<ConfirmDialogChoice> {
  const hidden = args.waitHidden();
  args.hide();
  await hidden;
  return args.presentConfirmDialog(args.confirm);
}

export async function waitThenRunDocumentFollowUp(
  args: OptionsSheetHiddenPorts & {
    readonly run: () => Promise<void> | void;
  },
): Promise<void> {
  const hidden = args.waitHidden();
  args.hide();
  await hidden;
  await args.run();
}
