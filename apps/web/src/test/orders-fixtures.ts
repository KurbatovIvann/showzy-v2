export const ANNA_ORDER_ID = "11111111-1111-4111-8111-111111111111";
export const DONE_ORDER_ID = "22222222-2222-4222-8222-222222222222";

export const ANNA_ORDER = {
  orderId: ANNA_ORDER_ID,
  orderNumber: "KL-K7K3K4",
  customer: {
    nameSnapshot: "Анна Мельник",
    linkedCustomerId: null,
  },
  status: "new",
  itemCount: 3,
  totalGrossMinor: "150000",
  currency: "UAH",
  createdAt: "2026-03-15T12:00:00.000Z",
} as const;

export const DONE_ORDER = {
  orderId: DONE_ORDER_ID,
  orderNumber: "KL-CLOSED",
  customer: {
    nameSnapshot: "unlinked",
    linkedCustomerId: null,
  },
  status: "done",
  itemCount: 1,
  totalGrossMinor: "50000",
  currency: "UAH",
  createdAt: "2026-01-02T12:00:00.000Z",
} as const;
