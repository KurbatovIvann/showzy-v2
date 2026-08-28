import { useCallback, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import {
  PlusIcon,
  SearchIcon,
  UsersIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, EmptyState } from "../../../../components/ui";
import { EntityCardSkeleton } from "../shared/entity-card";
import { ClientRow } from "./client-row";
import type { ClientsListModel, ClientsListRow } from "./use-clients-list";

const SKELETON_ROWS = [0, 1, 2, 3] as const;

export function ClientsListPane(props: {
  readonly model: ClientsListModel;
  readonly openCreate: () => void;
}) {
  const { model, openCreate } = props;
  const { copy } = model;

  const renderItem: ListRenderItem<ClientsListRow> = useCallback(
    ({ item }) => (
      <ClientRow
        id={item.id}
        name={item.name}
        archived={item.archived}
        archivedLabel={copy.archivedBadge}
        groupName={item.groupName}
        phone={item.phone}
        email={item.email}
        priceListName={item.priceListName}
        counterpartiesLabel={item.counterpartiesLabel}
        editLabel={copy.editLabel}
        restoreLabel={copy.restoreLabel}
        archiveA11y={item.archiveA11y}
        deleteA11y={item.deleteA11y}
        canEdit={model.canEdit}
        canDelete={model.canDelete}
        disabled={model.writesPending}
        onEdit={model.openEdit}
        onArchive={model.archive}
        onRestore={model.restore}
        onRemove={model.remove}
      />
    ),
    [
      copy.archivedBadge,
      copy.editLabel,
      copy.restoreLabel,
      model.canEdit,
      model.canDelete,
      model.writesPending,
      model.openEdit,
      model.archive,
      model.restore,
      model.remove,
    ],
  );

  return (
    <ClientsListBody
      model={model}
      openCreate={openCreate}
      renderItem={renderItem}
    />
  );
}

function ClientsListBody(props: {
  readonly model: ClientsListModel;
  readonly openCreate: () => void;
  readonly renderItem: ListRenderItem<ClientsListRow>;
}) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  switch (model.state.kind) {
    case "loading":
      return (
        <View style={styles.skeletons} accessibilityLabel={copy.loadingLabel}>
          {SKELETON_ROWS.map((index) => (
            <EntityCardSkeleton key={index} />
          ))}
        </View>
      );
    case "offline":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.offlineTitle}
            description={copy.empty.offlineDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.errorTitle}
            description={copy.empty.errorDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.retry}
                onPress={model.retry}
              />
            }
          />
        </CenteredEmpty>
      );
    case "empty-search":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<SearchIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.searchTitle}
            description={copy.empty.searchDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.reset}
                onPress={model.resetFilters}
              />
            }
          />
        </CenteredEmpty>
      );
    case "empty-archived":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<UsersIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.archivedTitle}
            description={copy.empty.archivedDescription}
          />
        </CenteredEmpty>
      );
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<UsersIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.catalogTitle}
            description={copy.empty.catalogDescription}
            action={
              model.canCreate ? (
                <Button
                  icon={
                    <PlusIcon
                      size={theme.iconSize.sm}
                      color={theme.colors.primaryForeground}
                    />
                  }
                  label={copy.empty.create}
                  onPress={props.openCreate}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "empty-active":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<UsersIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.activeTitle}
            description={copy.empty.activeDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.showArchived}
                onPress={model.showArchived}
              />
            }
          />
        </CenteredEmpty>
      );
    case "rows":
      return (
        <View style={styles.rowsPane}>
          <FlashList
          data={model.rows}
          style={styles.list}
          keyExtractor={keyExtractor}
          renderItem={props.renderItem}
          ItemSeparatorComponent={RowSeparator}
          ListFooterComponent={
            model.loadingMore ? (
              <ActivityIndicator
                accessibilityLabel={copy.loadingMoreLabel}
                color={theme.colors.activityIndicator.onBackground}
                style={styles.footerSpinner}
              />
            ) : null
          }
          onEndReached={model.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={model.refreshing}
          onRefresh={model.refresh}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />
        </View>
      );
  }
}

function keyExtractor(row: ClientsListRow): string {
  return row.id;
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create((theme) => ({
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
  rowsPane: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["2xl"],
  },
  separator: {
    height: theme.spacing.md,
  },
  footerSpinner: {
    paddingVertical: theme.spacing.lg,
  },
}));
