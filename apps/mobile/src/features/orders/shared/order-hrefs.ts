/** Detail and editor routes are owned by SHO-212 / SHO-213. */
export function orderCreateHref(): string {
  return "/orders/new";
}

export function orderDetailHref(orderId: string): string {
  return `/orders/${orderId}`;
}
