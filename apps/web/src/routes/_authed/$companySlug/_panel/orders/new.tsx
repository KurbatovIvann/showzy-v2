import { createFileRoute } from "@tanstack/react-router";

import { catalogListProductsQueryOptions } from "../../../../../features/orders/api/catalog";
import { customersListQueryOptions } from "../../../../../features/orders/api/customers-list";
import { validateOrdersSearch } from "../../../../../features/orders/api/orders-list-search";
import { OrderCreatePage } from "../../../../../features/orders/form/order-create-page";
import { usePanelChrome } from "../../../../../layouts/panel/panel-chrome-context";
import {
  PANEL_DETAIL,
  useRequiredPanelState,
} from "../../../../../layouts/panel/panel-route-state";

export const Route = createFileRoute("/_authed/$companySlug/_panel/orders/new")(
  {
    validateSearch: validateOrdersSearch,
    staticData: PANEL_DETAIL,
    loader: ({ context }) => {
      const companyId = context.apiClient.getActiveCompany();
      if (companyId === null) {
        return;
      }
      void context.queryClient
        .ensureQueryData(
          customersListQueryOptions({
            client: context.apiClient,
            companyId,
          }),
        )
        .catch(() => {
          // Cached error; the page renders empty/retry UI.
        });
      void context.queryClient
        .ensureQueryData(
          catalogListProductsQueryOptions({
            client: context.apiClient,
            companyId,
          }),
        )
        .catch(() => {
          // Cached error; the page renders empty/retry UI.
        });
    },
    component: OrderCreateRoute,
  },
);

function OrderCreateRoute() {
  const { companySlug } = Route.useParams();
  const chrome = usePanelChrome();
  const panel = useRequiredPanelState();
  const navigate = Route.useNavigate();
  return (
    <OrderCreatePage
      showBack={chrome.mode === "phone" && panel.pane === "detail"}
      onBack={() => {
        void navigate({
          to: "/$companySlug/orders",
          params: { companySlug },
          search: (prev) => prev,
        });
      }}
      onCreated={(orderId) => {
        void navigate({
          to: "/$companySlug/orders/$orderId",
          params: { companySlug, orderId },
          search: (prev) => prev,
        });
      }}
    />
  );
}
