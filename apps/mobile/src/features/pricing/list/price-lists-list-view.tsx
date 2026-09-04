import { useCallback, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import {
  PlusIcon,
  SearchIcon,
  TagsIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  Button,
  ChoiceField,
  EmptyState,
  IconButton,
  ListRow,
  ListSurface,
  SearchField,
} from "../../../components/ui";
import { PriceListOptionsSheet } from "./price-list-options-sheet";
import { PriceListRow, PriceListRowSkeleton } from "./price-list-row";
import type {
  PriceListsListModel,
  PriceListsListRow,
} from "./use-price-lists-list";

const SKELETON_ROWS = [0, 1, 2] as const;

export function PriceListsListView(model: PriceListsListModel) {
  const { theme } = useUnistyles();
  const { copy, openEdit, openOptions } = model;

  const renderItem: ListRenderItem<PriceListsListRow> = useCallback(
    ({ item, index }) => (
      <ListRow first={index === 0}>
        <PriceListRow
          id={item.id}
          name={item.name}
          isDefault={item.isDefault}
          isActive={item.isActive}
          pricesLabel={item.pricesLabel}
          defaultBadge={copy.defaultBadge}
          inactiveBadge={copy.inactiveBadge}
          editLabel={copy.editLabel}
          optionsA11y={item.optionsA11y}
          canManage={model.canManage}
          disabled={model.writesPending}
          onEdit={openEdit}
          onOptions={openOptions}
        />
      </ListRow>
    ),
    [
      copy.defaultBadge,
      copy.inactiveBadge,
      copy.editLabel,
      model.canManage,
      model.writesPending,
      openEdit,
      openOptions,
    ],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      {/* Named deviation: omit canvas subtitle (no total/activeCount). */}
      <AppHeader
        title={copy.title}
        back={{
          onPress: model.goBack,
          accessibilityLabel: copy.backLabel,
        }}
        actions={
          model.canManage ? (
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
      {model.banner !== null ? (
        <View style={styles.banner}>
          <Banner message={model.banner} />
        </View>
      ) : null}
      <View style={styles.controls}>
        <SearchField
          value={model.searchText}
          onChangeText={model.changeSearch}
          placeholder={copy.searchPlaceholder}
          accessibilityLabel={copy.searchLabel}
          maxLength={model.searchMaxLength}
        />
        <ChoiceField
          options={model.availabilityOptions}
          selected={model.availability}
          onSelect={model.changeAvailability}
        />
      </View>
      <PriceListsListBody model={model} renderItem={renderItem} />
      <PriceListOptionsSheet
        visible={model.optionsVisible}
        list={model.optionsList}
        copy={copy}
        canManage={model.canManage}
        onClose={model.closeOptions}
        onHidden={model.onOptionsHidden}
        onSetDefault={() => {
          void model.setDefault();
        }}
        onToggleActive={() => {
          void model.toggleActive();
        }}
        onDelete={() => {
          void model.remove();
        }}
      />
    </SafeAreaView>
  );
}

function PriceListsListBody(props: {
  readonly model: PriceListsListModel;
  readonly renderItem: ListRenderItem<PriceListsListRow>;
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
                <PriceListRowSkeleton />
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
    case "empty-filtered":
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
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<TagsIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.catalogTitle}
            description={copy.empty.catalogDescription}
            action={
              model.canManage ? (
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
        <View style={styles.rowsPane}>
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
          {model.showHint ? <Text style={styles.hint}>{copy.hint}</Text> : null}
        </View>
      );
  }
}

function keyExtractor(row: PriceListsListRow): string {
  return row.id;
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  banner: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
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
  footerSpinner: {
    paddingVertical: theme.spacing.lg,
  },
  hint: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.card,
    color: theme.colors.mutedForeground,
    // Class B: canvas 13 → typography.xs.
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
}));
