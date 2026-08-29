import { useCallback, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { MailPlusIcon, PlusIcon, WifiOffIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, EmptyState } from "../../../components/ui";
import { EntityCardSkeleton } from "../shared/entity-card";
import { InvitationRow } from "./invitation-row";
import type {
  InvitationsListModel,
  InvitationsListRow,
} from "./use-invitations-list";

const SKELETON_ROWS = [0, 1, 2] as const;

export function InvitationsListPane(props: {
  readonly model: InvitationsListModel;
  readonly openCreate: () => void;
}) {
  const { model, openCreate } = props;

  const onRevoke = useCallback(
    (id: string) => {
      void model.revoke(id);
    },
    [model.revoke],
  );

  const renderItem: ListRenderItem<InvitationsListRow> = useCallback(
    ({ item }) => (
      <InvitationRow
        id={item.id}
        title={item.title}
        statusLabel={item.statusLabel}
        statusTone={item.statusTone}
        groupName={item.groupName}
        priceListName={item.priceListName}
        phone={item.phone}
        email={item.email}
        usesLabel={item.usesLabel}
        expiryLabel={item.expiryLabel}
        revokeA11y={item.revokeA11y}
        showRevoke={item.showRevoke}
        disabled={model.writesPending}
        onRevoke={onRevoke}
      />
    ),
    [model.writesPending, onRevoke],
  );

  return (
    <InvitationsListBody
      model={model}
      openCreate={openCreate}
      renderItem={renderItem}
    />
  );
}

function InvitationsListBody(props: {
  readonly model: InvitationsListModel;
  readonly openCreate: () => void;
  readonly renderItem: ListRenderItem<InvitationsListRow>;
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
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<MailPlusIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.invitationsTitle}
            description={copy.empty.invitationsDescription}
            action={
              model.canCreate ? (
                <Button
                  icon={
                    <PlusIcon
                      size={theme.iconSize.sm}
                      color={theme.colors.primaryForeground}
                    />
                  }
                  label={copy.empty.invitationsCreate}
                  onPress={props.openCreate}
                />
              ) : undefined
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

function keyExtractor(row: InvitationsListRow): string {
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
