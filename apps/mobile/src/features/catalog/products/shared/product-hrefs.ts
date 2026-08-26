/** Photos attach on create, edit, and detail. Never a `/photos` route. */
export function productEditorHref(productId: string): string {
  return `/products/${productId}/edit`;
}

export function productPhotoHref(productId: string): string {
  return `/products/${productId}`;
}
