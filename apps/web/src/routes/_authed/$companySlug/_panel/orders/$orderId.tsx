import { createFileRoute } from "@tanstack/react-router";

import {
  ordersGetQueryOptions,
  parseOrderId,
} from "../../../../../features/orders/api/get";
import { OrderDetailPage } from "../../../../../features/orders/detail/order-detail-page";
import { validateOrdersSearch } from "../../../../../features/orders/api/orders-list-search";
import { usePanelChrome } from "../../../../../layouts/panel/panel-chrome-context";
import {
  PANEL_DETAIL,
  useRequiredPanelState,
} from "../../../../../layouts/panel/panel-route-state";

export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/orders/$orderId",
)({
  validateSearch: validateOrdersSearch,
  staticData: PANEL_DETAIL,
  loader: ({ context, params }) => {
    const companyId = context.apiClient.getActiveCompany();
    const orderId = parseOrderId(params.orderId);
    if (companyId === null || orderId === null) {
      return;
    }
    void context.queryClient
      .ensureQueryData(
        ordersGetQueryOptions({
          client: context.apiClient,
          companyId,
          orderId,
        }),
      )
      .catch(() => {
        // Cached error; the page renders retry / not-found UI.
      });
  },
  component: OrderDetailRoute,
});

function OrderDetailRoute() {
  const { orderId, companySlug } = Route.useParams();
  const chrome = usePanelChrome();
  const panel = useRequiredPanelState();
  const navigate = Route.useNavigate();
  return (
    <OrderDetailPage
      orderId={orderId}
      showBack={chrome.mode === "phone" && panel.pane === "detail"}
      onBack={() => {
        void navigate({
          to: "/$companySlug/orders",
          params: { companySlug },
          search: (prev) => prev,
        });
      }}
    />
  );
}
