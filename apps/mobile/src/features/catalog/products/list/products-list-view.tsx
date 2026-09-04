import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Button,
  ChoiceField,
  EmptyState,
  IconButton,
  ListRow,
  ListSurface,
  SearchField,
} from "../../../../components/ui";
import { ProductRow, ProductRowSkeleton } from "./product-row";
import type { ProductsListModel, ProductsListRow } from "./use-products-list";

const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

export function ProductsListView(model: ProductsListModel) {
  const { theme } = useUnistyles();
  const { copy, openProduct } = model;

  const renderItem: ListRenderItem<ProductsListRow> = useCallback(
    ({ item, index }) => (
      <ListRow first={index === 0}>
        <ProductRow
          id={item.id}
          name={item.name}
          priceLabel={item.priceLabel}
          archived={item.archived}
          archivedLabel={copy.archivedBadge}
          variantsLabel={item.variantsLabel}
          thumbnailFileId={item.thumbnailFileId}
          thumbnailUrl={item.thumbnailUrl}
          thumbnailFailed={item.thumbnailFailed}
          thumbnailFailedLabel={copy.thumbnailUnavailable}
          onPress={openProduct}
        />
      </ListRow>
    ),
    [copy.archivedBadge, copy.thumbnailUnavailable, openProduct],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      {/* Named deviation: omit canvas subtitle "N активних" (no activeCount). */}
      <AppHeader
        title={copy.title}
        actions={
          model.canCreate ? (
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
        <SearchField
          value={model.searchText}
          onChangeText={model.changeSearch}
          placeholder={copy.searchPlaceholder}
          accessibilityLabel={copy.searchLabel}
          maxLength={model.searchMaxLength}
        />
        <ChoiceField
          options={[
            { key: "all", label: copy.filters.all },
            { key: "active", label: copy.filters.active },
            { key: "archived", label: copy.filters.archived },
          ]}
          selected={model.filter}
          onSelect={model.changeFilter}
        />
      </View>
      <ProductsListBody model={model} renderItem={renderItem} />
    </SafeAreaView>
  );
}

function ProductsListBody(props: {
  readonly model: ProductsListModel;
  readonly renderItem: ListRenderItem<ProductsListRow>;
}) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  switch (model.state.kind) {
    case "loading":
      return (
        <View style={styles.skeletons} accessibilityLabel={copy.loadingLabel}>
          <ListSurface>
            {SKELETON_ROWS.map((index) => (
              <ListRow key={index} first={index === 0}>
                <ProductRowSkeleton />
              </ListRow>
            ))}
          </ListSurface>
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
                onPress={model.resetSearch}
              />
            }
          />
        </CenteredEmpty>
      );
    case "empty-archived":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<PackageIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.archivedTitle}
            description={copy.empty.archivedDescription}
          />
        </CenteredEmpty>
      );
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<PackageIcon size={theme.iconSize.md} color={iconColor} />}
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
                  onPress={model.openCreate}
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
            icon={<PackageIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.activeTitle}
            description={copy.empty.activeDescription}
            action={
              <Button
                variant="secondary"
                label={copy.empty.showAll}
                onPress={model.showAll}
              />
            }
          />
        </CenteredEmpty>
      );
    case "rows":
      return (
        <View style={styles.rowsPane}>
          {/*
            Canvas `sticky top-0 bg-canvas` "Знайдено · N". Sibling of
            FlashList so the loaded-page count stays put while rows
            scroll (ListHeaderComponent does not). Omit live "N активних".
          */}
          <Text accessibilityRole="header" style={styles.foundCount}>
            {model.foundCountLabel}
          </Text>
          <View style={styles.surfacePane}>
            <ListSurface style={styles.surfaceFill}>
              <FlashList
                data={model.rows}
                style={styles.list}
                keyExtractor={keyExtractor}
                renderItem={props.renderItem}
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
            </ListSurface>
          </View>
        </View>
      );
  }
}

function keyExtractor(row: ProductsListRow): string {
  return row.id;
}

function CenteredEmpty({ children }: { readonly children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  controls: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  skeletons: {
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
  surfacePane: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  surfaceFill: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.spacing["2xl"],
  },
  foundCount: {
    color: theme.colors.mutedForeground,
    // Class B: canvas 12px / py-2.5 → typography.xs (13) / spacing.sm (8).
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  footerSpinner: {
    paddingVertical: theme.spacing.lg,
  },
}));
