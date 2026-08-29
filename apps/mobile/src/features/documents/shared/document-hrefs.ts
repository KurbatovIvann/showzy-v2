export function documentsHref(orderId?: string): string {
  if (orderId === undefined) {
    return "/documents";
  }
  return `/documents?orderId=${orderId}`;
}

export function documentsCreateHref(): string {
  return "/documents/new";
}
