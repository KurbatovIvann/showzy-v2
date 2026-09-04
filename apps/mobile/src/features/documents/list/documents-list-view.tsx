import { useCallback, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { FileTextIcon, PlusIcon, WifiOffIcon } from "lucide-react-native";
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
} from "../../../components/ui";
import { DocumentHandoverSheet } from "../share/document-handover-sheet";
import { DocumentSigningSheet } from "../signing/document-signing-sheet";
import { DocumentOptionsSheet } from "./document-options-sheet";
import { DocumentRow, DocumentRowSkeleton } from "./document-row";
import type {
  DocumentsListModel,
  DocumentsListRow,
} from "./use-documents-list";

const SKELETON_ROWS = [0, 1, 2] as const;

export function DocumentsListView(model: DocumentsListModel) {
  const { theme } = useUnistyles();
  const { copy, openOptions, signRow } = model;

  const renderItem: ListRenderItem<DocumentsListRow> = useCallback(
    ({ item, index }) => (
      <ListRow first={index === 0}>
        <DocumentRow
          id={item.id}
          documentNumber={item.documentNumber}
          typeLabel={item.typeLabel}
          buyerLabel={item.buyerLabel}
          issuedOnLabel={item.issuedOnLabel}
          totalLabel={item.totalLabel}
          cancelled={item.cancelled}
          cancelledBadge={copy.cancelledBadge}
          signedBadge={copy.signedBadge}
          showSign={item.showSign}
          showSignedChip={item.showSignedChip}
          signButton={copy.signButton}
          optionsA11y={item.optionsA11y}
          optionsButton={copy.optionsButton}
          disabled={model.writesPending}
          onSign={signRow}
          onOptions={openOptions}
        />
      </ListRow>
    ),
    [
      copy.cancelledBadge,
      copy.optionsButton,
      copy.signButton,
      copy.signedBadge,
      model.writesPending,
      openOptions,
      signRow,
    ],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      <AppHeader
        title={copy.title}
        back={{
          onPress: model.goBack,
          accessibilityLabel: copy.backLabel,
        }}
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
      {model.banner !== null ? (
        <View style={styles.banner}>
          <Banner message={model.banner} />
        </View>
      ) : null}
      <View style={styles.controls}>
        {/* Named deviation: no SearchField — SHO-227 omit list. */}
        <ChoiceField
          options={[
            { key: "all", label: copy.filters.all },
            { key: "payment_invoice", label: copy.filters.payment_invoice },
            { key: "delivery_note", label: copy.filters.delivery_note },
          ]}
          selected={model.type}
          onSelect={model.changeType}
        />
      </View>
      <DocumentsListBody model={model} renderItem={renderItem} />
      <DocumentOptionsSheet
        visible={model.optionsVisible}
        document={model.optionsRow}
        copy={copy}
        canView={model.canView}
        canEdit={model.canEdit}
        getLoad={model.getLoad}
        generationStatus={model.generationStatus}
        pdfDownloadUrl={model.pdfDownloadUrl}
        signingStatus={model.signingStatus}
        onClose={model.closeOptions}
        onHidden={model.onOptionsHidden}
        onShare={() => {
          model.share();
        }}
        onQr={() => {
          model.openQr();
        }}
        onPrint={() => {
          void model.print();
        }}
        onOpenPdf={() => {
          void model.openPdf();
        }}
        onSign={() => {
          void model.sign();
        }}
        onCancel={() => {
          void model.cancel();
        }}
      />
      <DocumentSigningSheet
        session={model.signingSession}
        copy={copy}
        onClose={model.closeSigning}
        onHidden={model.onSigningHidden}
        onPickKey={() => {
          void model.pickSigningKey();
        }}
        onChangePassword={model.setSigningPassword}
        onSubmit={() => {
          void model.submitSigning();
        }}
      />
      <DocumentHandoverSheet
        visible={model.handoverVisible}
        title={model.handoverTitle}
        url={model.handoverUrl}
        copy={copy}
        copied={model.copied}
        copyFailed={model.copyFailed}
        onClose={model.closeHandover}
        onHidden={model.onHandoverHidden}
        onCopy={() => {
          void model.copyHandover();
        }}
        onShare={() => {
          void model.shareHandover();
        }}
      />
    </SafeAreaView>
  );
}

function DocumentsListBody(props: {
  readonly model: DocumentsListModel;
  readonly renderItem: ListRenderItem<DocumentsListRow>;
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
                <DocumentRowSkeleton />
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
            icon={<FileTextIcon size={theme.iconSize.md} color={iconColor} />}
            title={copy.empty.filteredTitle}
            description={model.filteredEmpty.description}
            action={
              model.filteredEmpty.showReset ? (
                <Button
                  variant="secondary"
                  label={copy.empty.reset}
                  onPress={model.resetFilters}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "empty-catalog":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<FileTextIcon size={theme.iconSize.md} color={iconColor} />}
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
    case "rows":
      return (
        <View style={styles.surfacePane}>
          <ListSurface style={styles.surfaceFill}>
            <FlashList
              data={model.rows}
              style={styles.list}
              keyExtractor={keyExtractor}
              renderItem={props.renderItem}
              ListFooterComponent={
                <DocumentsFooter
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
          </ListSurface>
        </View>
      );
  }
}

function DocumentsFooter(props: {
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
    </View>
  );
}

function keyExtractor(row: DocumentsListRow): string {
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
}));
