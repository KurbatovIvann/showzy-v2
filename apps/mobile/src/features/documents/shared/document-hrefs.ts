export function documentsHref(orderId?: string): string {
  if (orderId === undefined) {
    return "/documents";
  }
  return `/documents?orderId=${orderId}`;
}

export function documentsCreateHref(): string {
  return "/documents/new";
}

/** In-app public token route. Company id is never a query grant. */
export function documentsSharedHref(token: string): string {
  return `/d/${token}`;
}
