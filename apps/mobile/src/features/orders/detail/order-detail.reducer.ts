/**
 * Order-detail sheet chrome (SHO-212). Local reducer, not XState:
 * the actions sheet is the only overlay on this screen.
 */
export type DetailSheets = {
  readonly actions: boolean;
};

export const IDLE_DETAIL_SHEETS: DetailSheets = {
  actions: false,
};

export type OrderDetailSheetAction =
  { readonly type: "openActions" } | { readonly type: "closeAll" };

export function reduceOrderDetailSheets(
  _state: DetailSheets,
  action: OrderDetailSheetAction,
): DetailSheets {
  switch (action.type) {
    case "openActions":
      return { actions: true };
    case "closeAll":
      return IDLE_DETAIL_SHEETS;
  }
}

export function orderDetailSheetChrome(sheets: DetailSheets): {
  readonly actionsVisible: boolean;
} {
  return { actionsVisible: sheets.actions };
}
