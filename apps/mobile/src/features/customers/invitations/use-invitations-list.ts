import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { CustomersCopy } from "../../../i18n/customers";
import { interpolate, type Locale } from "../../../i18n/locale";
import { listInvitesInfiniteOptions } from "../api/invite.queries";
import {
  classifyInvitationsList,
  flattenInviteListPages,
  inviteExpiryLabel,
  inviteRowActions,
  inviteStatusLabel,
  inviteStatusTone,
  inviteUsesLabel,
  toInviteRowView,
  type InviteStatusTone,
  type InvitationsListState,
} from "./invitations-list.presenter";
import { useInviteWrites } from "./use-invite-writes";

export type InvitationsListRow = {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly statusTone: InviteStatusTone;
  readonly groupName: string | null;
  readonly priceListName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly usesLabel: string;
  readonly expiryLabel: string;
  readonly revokeA11y: string;
  readonly showRevoke: boolean;
};

export function useInvitationsList(args: {
  readonly copy: CustomersCopy;
  readonly locale: Locale;
  readonly groupsById: ReadonlyMap<string, string>;
  readonly priceListsById: ReadonlyMap<string, string>;
  readonly canCreate: boolean;
  readonly canInvite: boolean;
}) {
  const { copy, locale } = args;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const writes = useInviteWrites({
    copy,
    canInvite: args.canInvite,
  });

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listInvitesInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: {},
      getActiveCompany,
    }),
  );

  const rows = useMemo((): readonly InvitationsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenInviteListPages(pages).map((item) => {
      const view = toInviteRowView(item, args.groupsById, args.priceListsById, {
        reusable: copy.inviteUntitledReusable,
        personal: copy.inviteUntitledPersonal,
      });
      return {
        id: view.id,
        title: view.title,
        statusLabel: inviteStatusLabel(view.status, copy.inviteStatus),
        statusTone: inviteStatusTone(view.status),
        groupName: view.groupName,
        priceListName: view.priceListName,
        phone: view.phone,
        email: view.email,
        usesLabel: inviteUsesLabel(view.usesCount, view.maxUses, {
          limited: copy.inviteUses,
          unlimited: copy.inviteUsesUnlimited,
        }),
        expiryLabel: inviteExpiryLabel(view.expiresAt, view.status, locale, {
          pending: copy.inviteExpires,
          ended: copy.inviteExpired,
        }),
        revokeA11y: interpolate(copy.revokeLabel, { name: view.title }),
        showRevoke: inviteRowActions({
          status: view.status,
          canInvite: args.canInvite,
        }).showRevoke,
      };
    });
  }, [
    listQuery.data?.pages,
    args.groupsById,
    args.priceListsById,
    args.canInvite,
    locale,
    copy,
  ]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: InvitationsListState = classifyInvitationsList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
  });

  return {
    copy,
    state,
    rows,
    canCreate: args.canCreate,
    canInvite: args.canInvite,
    banner: writes.banner,
    writesPending: writes.pending,
    revoke: writes.revoke,
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh: () => {
      void listQuery.refetch();
    },
    retry: () => {
      void listQuery.refetch();
    },
    loadingMore: listQuery.isFetchingNextPage,
    loadMore: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
  };
}

export type InvitationsListModel = ReturnType<typeof useInvitationsList>;
