/**
 * Handover-sheet chrome (SHO-237 / SHO-238). Close sets `visible=false`
 * first; `url` stays until `onHidden` so the body does not blank
 * mid-animation. Shared by the list options path and the create form.
 */
export type DocumentHandoverChrome = {
  readonly visible: boolean;
  readonly url: string | null;
  readonly documentNumber: string | null;
};

export const IDLE_DOCUMENT_HANDOVER: DocumentHandoverChrome = {
  visible: false,
  url: null,
  documentNumber: null,
};

export function openDocumentHandover(args: {
  readonly url: string;
  readonly documentNumber: string;
}): DocumentHandoverChrome {
  return {
    visible: true,
    url: args.url,
    documentNumber: args.documentNumber,
  };
}

export function hideDocumentHandover(
  state: DocumentHandoverChrome,
): DocumentHandoverChrome {
  return {
    visible: false,
    url: state.url,
    documentNumber: state.documentNumber,
  };
}

export function documentHandoverHidden(
  state: DocumentHandoverChrome,
): DocumentHandoverChrome {
  if (state.visible) {
    return state;
  }
  return IDLE_DOCUMENT_HANDOVER;
}
