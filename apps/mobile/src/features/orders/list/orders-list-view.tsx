import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import {
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  SlidersHorizontalIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Button,
  EmptyState,
  IconButton,
} from "../../../components/ui";
import { interpolate } from "../../../i18n/locale";
import { OrderRow, OrderRowSkeleton } from "./order-row";
import { OrdersFilterSheet } from "./orders-filter-sheet";
import {
  orderGroupHeaderLabel,
  type OrdersListEntry,
} from "./orders-list.presenter";
import type { OrdersListModel } from "./use-orders-list";

const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

export function OrdersListView(model: OrdersListModel) {
  const { theme } = useUnistyles();
  const { copy, openOrder } = model;
  const filterActive = model.filterCount > 0;
  const filterLabel =
    model.filterCount > 0
      ? interpolate(copy.filterActiveLabel, {
          count: String(model.filterCount),
        })
      : copy.filterLabel;

  const renderItem: ListRenderItem<OrdersListEntry> = useCallback(
    ({ item }) => {
      if (item.type === "header") {
        return (
          <Text accessibilityRole="header" style={styles.groupHeader}>
            {orderGroupHeaderLabel(item.key, item.count, copy)}
          </Text>
        );
      }
      return (
        <OrderRow
          id={item.order.id}
          customerName={item.order.customerName}
          customerNamePending={item.order.customerNamePending}
          statusLabel={item.order.statusLabel}
          statusTone={item.order.statusTone}
          metaLabel={item.order.metaLabel}
          totalLabel={item.order.totalLabel}
          onPress={openOrder}
        />
      );
    },
    [copy, openOrder],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      <AppHeader
        title={copy.title}
        actions={
          model.showCreate ? (
            <IconButton
              icon={
                <PlusIcon
                  size={theme.iconSize.md}
                  color={theme.colors.primaryForeground}
                />
              }
              accessibilityLabel={copy.createLabel}
              onPress={model.openCreate}
            />
          ) : undefined
        }
      />
      <View style={styles.controls}>
        <View>
          <IconButton
            variant={filterActive ? "primary" : "surface"}
            icon={
              <SlidersHorizontalIcon
                size={theme.iconSize.sm}
                color={
                  filterActive
                    ? theme.colors.primaryForeground
                    : theme.colors.foreground
                }
              />
            }
            accessibilityLabel={filterLabel}
            onPress={model.openFilters}
          />
          {filterActive ? (
            <View style={styles.filterBadge} pointerEvents="none">
              <Text style={styles.filterBadgeLabel}>
                {String(model.filterCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {filterActive ? (
        <View style={styles.chipRow}>
          {model.selectedFilterChips.map((chip) => (
            <View key={chip.key} style={styles.filterChip}>
              <Text style={styles.filterChipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <OrdersListBody model={model} renderItem={renderItem} />
      <OrdersFilterSheet
        visible={model.filterSheetVisible}
        copy={copy}
        selected={model.selectedStatuses}
        onClose={model.closeFilters}
        onToggle={model.toggleStatus}
        onReset={model.resetFilters}
      />
    </SafeAreaView>
  );
}

function OrdersListBody(props: {
  readonly model: OrdersListModel;
  readonly renderItem: ListRenderItem<OrdersListEntry>;
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
            <OrderRowSkeleton key={index} />
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
    case "empty-filtered":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<SearchIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.filteredTitle}
            description={copy.empty.filteredDescription}
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
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={
              <ShoppingBagIcon size={theme.iconSize.md} color={iconColor} />
            }
            title={copy.empty.catalogTitle}
            description={copy.empty.catalogDescription}
            action={
              model.showCreate ? (
                <Button
                  icon={
                    <PlusIcon
                      size={theme.iconSize.sm}
                      color={theme.colors.primaryForeground}
                    />
                  }
                  label={copy.empty.create}
                  onPress={model.openCreate}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "rows":
      return (
        <FlashList
          data={model.entries}
          style={styles.list}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          renderItem={props.renderItem}
          stickyHeaderIndices={model.stickyHeaderIndices}
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
          contentContainerStyle={styles.listContent}
        />
      );
  }
}

function keyExtractor(entry: OrdersListEntry): string {
  return entry.type === "header" ? `header:${entry.key}` : entry.order.id;
}

function getItemType(entry: OrdersListEntry): string {
  return entry.type;
}

function CenteredEmpty({ children }: { readonly children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function RowSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  filterChip: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  filterChipLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography["2xs"].fontSize,
    lineHeight: theme.typography["2xs"].lineHeight,
  },
  filterBadge: {
    position: "absolute",
    top: -theme.spacing["2xs"],
    right: -theme.spacing["2xs"],
    minWidth: theme.spacing.lg,
    height: theme.spacing.lg,
    paddingHorizontal: theme.spacing["2xs"],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeLabel: {
    color: theme.colors.accentForeground,
    fontSize: theme.typography["2xs"].fontSize,
    lineHeight: theme.typography["2xs"].lineHeight,
    fontWeight: "600",
  },
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["2xl"],
  },
  groupHeader: {
    color: theme.colors.icon.muted,
    backgroundColor: theme.colors.background,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingVertical: theme.spacing.sm,
  },
  separator: {
    height: theme.spacing.md,
  },
  footerSpinner: {
    paddingVertical: theme.spacing.lg,
  },
}));
