export function priceListsHref(): string {
  return "/price-lists";
}

export function priceListCreateHref(): string {
  return "/price-lists/new";
}

export function priceListEditorHref(priceListId: string): string {
  return `/price-lists/${priceListId}/edit`;
}
