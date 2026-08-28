import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { useCounterpartiesList } from "../counterparties/use-counterparties-list";
import { useGroupsList } from "../groups/use-groups-list";
import {
  counterpartyCreateHref,
  customerCreateHref,
  groupCreateHref,
} from "../shared/customer-hrefs";
import {
  canCreateCustomers,
  canDeleteCustomers,
  canEditCustomers,
} from "../shared/customer-permissions";
import {
  canShowCustomersCreate,
  customersCreateKind,
  customersCreateLabel,
  type CustomersTab,
} from "./customers-home.presenter";
import { useClientsList } from "./use-clients-list";
import { useCustomerLookups } from "./use-customer-lookups";

export function useCustomersHome() {
  const locale = detectLocale();
  const copy = useMemo(() => customersCopy(locale), [locale]);
  const membership = useResolvedCompany();
  const router = useRouter();
  const [tab, setTab] = useState<CustomersTab>("clients");

  const canCreateRole = canCreateCustomers(membership.role);
  const canEdit = canEditCustomers(membership.role);
  const canDelete = canDeleteCustomers(membership.role);
  const lookups = useCustomerLookups();

  const clients = useClientsList({
    copy,
    locale,
    groups: lookups.groups,
    groupsById: lookups.groupsById,
    priceListsById: lookups.priceListsById,
    groupsLookupSettled: lookups.groupsLookupSettled,
    canCreate: canCreateRole,
    canEdit,
    canDelete,
  });
  const groups = useGroupsList({
    copy,
    locale,
    priceListsById: lookups.priceListsById,
    canCreate: canEdit,
    canEdit,
  });
  const counterparties = useCounterpartiesList({
    copy,
    canCreate: canEdit,
    canEdit,
  });

  const canCreate = canShowCustomersCreate({
    tab,
    canCreateCustomers: canCreateRole,
    canEditCustomers: canEdit,
  });
  const createKind = customersCreateKind(tab);
  const createLabel = customersCreateLabel(createKind, {
    client: copy.createClientLabel,
    group: copy.createGroupLabel,
    counterparty: copy.createCounterpartyLabel,
  });

  return {
    copy,
    tab,
    selectTab: setTab,
    canCreate,
    createLabel,
    openCreate: () => {
      if (createKind === "client") {
        router.push(customerCreateHref());
      }
      if (createKind === "group") {
        router.push(groupCreateHref());
      }
      if (createKind === "counterparty") {
        router.push(counterpartyCreateHref());
      }
    },
    banner: clients.banner ?? groups.banner ?? counterparties.banner,
    clients,
    groups,
    counterparties,
  };
}

export type CustomersHomeModel = ReturnType<typeof useCustomersHome>;
