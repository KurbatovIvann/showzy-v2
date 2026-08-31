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
    ({ item }) => (
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
          {SKELETON_ROWS.map((index) => (
            <PriceListRowSkeleton key={index} />
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
        <FlashList
          data={model.rows}
          style={styles.list}
          keyExtractor={keyExtractor}
          renderItem={props.renderItem}
          ItemSeparatorComponent={RowSeparator}
          ListFooterComponent={
            <PriceListsFooter
              hint={model.showHint ? copy.hint : null}
              loadingMore={model.loadingMore}
              loadingMoreLabel={copy.loadingMoreLabel}
            />
          }
          onEndReached={model.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={model.refreshing}
          onRefresh={model.refresh}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        />
      );
  }
}

function PriceListsFooter(props: {
  readonly hint: string | null;
  readonly loadingMore: boolean;
  readonly loadingMoreLabel: string;
}) {
  const { theme } = useUnistyles();
  return (
    <View>
      {props.loadingMore ? (
        <ActivityIndicator
          accessibilityLabel={props.loadingMoreLabel}
          color={theme.colors.activityIndicator.onBackground}
          style={styles.footerSpinner}
        />
      ) : null}
      {props.hint !== null ? (
        <Text style={styles.hint}>{props.hint}</Text>
      ) : null}
    </View>
  );
}

function keyExtractor(row: PriceListsListRow): string {
  return row.id;
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
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
  separator: {
    height: theme.spacing.md,
  },
  footerSpinner: {
    paddingVertical: theme.spacing.lg,
  },
  hint: {
    marginTop: theme.spacing.md,
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
