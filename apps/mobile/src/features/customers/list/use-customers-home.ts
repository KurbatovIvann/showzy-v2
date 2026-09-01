import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { useCounterpartiesList } from "../counterparties/use-counterparties-list";
import { useGroupsList } from "../groups/use-groups-list";
import { useInvitationsList } from "../invitations/use-invitations-list";
import {
  counterpartyCreateHref,
  customerCreateHref,
  groupCreateHref,
  inviteCreateHref,
} from "../shared/customer-hrefs";
import {
  canCreateCustomers,
  canDeleteCustomers,
  canEditCustomers,
  canInviteCustomers,
} from "../shared/customer-permissions";
import {
  canShowCustomersCreate,
  customersCreateKind,
  customersCreateLabel,
  customersHomeBanner,
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
  const canInvite = canInviteCustomers(membership.role);
  const lookups = useCustomerLookups();

  // SHO-295 owner decision 5 / SHO-307: all four tab infinite queries
  // mount on home so a swipe is a cache hit, not a first fetch. Prefetch
  // intent is confirmed — do not `enabled`-gate hidden tabs on first focus.
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
  const invitations = useInvitationsList({
    copy,
    locale,
    groupsById: lookups.groupsById,
    priceListsById: lookups.priceListsById,
    canCreate: canInvite,
    canInvite,
  });

  const canCreate = canShowCustomersCreate({
    tab,
    canCreateCustomers: canCreateRole,
    canEditCustomers: canEdit,
    canInviteCustomers: canInvite,
  });
  const createKind = customersCreateKind(tab);
  const createLabel = customersCreateLabel(createKind, {
    client: copy.createClientLabel,
    group: copy.createGroupLabel,
    counterparty: copy.createCounterpartyLabel,
    invite: copy.createInviteLabel,
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
      if (createKind === "invite") {
        router.push(inviteCreateHref());
      }
    },
    banner: customersHomeBanner(tab, {
      clients: clients.banner,
      groups: groups.banner,
      counterparties: counterparties.banner,
      invitations: invitations.banner,
    }),
    clients,
    groups,
    counterparties,
    invitations,
  };
}

export type CustomersHomeModel = ReturnType<typeof useCustomersHome>;
