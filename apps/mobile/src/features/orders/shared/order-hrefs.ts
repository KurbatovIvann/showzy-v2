/** Editor route is owned by SHO-213. Detail is `/orders/[id]` (SHO-212). */
export function orderCreateHref(): string {
  return "/orders/new";
}

export function orderDetailHref(orderId: string): string {
  return `/orders/${orderId}`;
}
