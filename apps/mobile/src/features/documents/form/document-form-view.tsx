/**
 * Canvas DocumentEditor as create-only (SHO-238).
 * Shared: AppHeader, Button, Banner, EmptyState, Sheet, SearchField.
 * Feature: SelectorRow, EditorSection, DocumentTypeCards, OptionSelectSheet.
 * Omitted: template picker, agreement, city, dates, QES, four types.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import {
  FileTextIcon,
  LockIcon,
  UserIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Banner, Button, EmptyState } from "../../../components/ui";
import {
  LIST_COUNTERPARTIES_SEARCH_MAX,
  LIST_ORDERS_QUERY_MAX,
} from "../shared/document-caps";
import { DocumentHandoverSheet } from "../share/document-handover-sheet";
import { DocumentTypeCards } from "./document-form-fields";
import { EditorSection } from "./editor-section";
import { OptionSelectSheet } from "./option-select-sheet";
import { SelectorRow } from "./selector-row";
import type { DocumentFormModel } from "./use-document-form";

export function DocumentFormView(model: DocumentFormModel) {
  const form = model.copy.form;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={model.copy.createLabel}
      style={styles.screen}
    >
      <AppHeader
        title={model.copy.createLabel}
        back={{
          onPress: model.requestLeave,
          accessibilityLabel: model.copy.backLabel,
        }}
      />
      <DocumentFormBody model={model} />
      {model.state.kind === "ready" && model.showSubmit ? (
        <View style={styles.footerDock}>
          <View style={styles.footerCard}>
            <View style={styles.footerActions}>
              <View style={styles.footerButton}>
                <Button
                  variant="secondary"
                  fullWidth
                  label={form.cancel}
                  disabled={model.pending}
                  onPress={model.requestLeave}
                />
              </View>
              <View style={styles.footerButton}>
                <Button
                  fullWidth
                  label={model.submitLabel}
                  loading={model.pending}
                  disabled={model.submitDisabled}
                  onPress={model.save}
                />
              </View>
            </View>
          </View>
        </View>
      ) : null}
      <OptionSelectSheet
        visible={model.orderSheetOpen}
        title={form.orderSheetTitle}
        searchPlaceholder={form.orderSearchPlaceholder}
        searchLabel={form.orderSearchLabel}
        closeLabel={form.closeSheet}
        emptyLabel={form.orderEmpty}
        value={model.selectedOrderId}
        options={model.orderOptions}
        searchMaxLength={LIST_ORDERS_QUERY_MAX}
        onClose={model.closeOrderSheet}
        onChange={(id) => {
          if (id !== null) {
            model.pickOrder(id);
          }
        }}
      />
      <OptionSelectSheet
        visible={model.counterpartySheetOpen}
        title={form.counterpartySheetTitle}
        searchPlaceholder={form.counterpartySearchPlaceholder}
        searchLabel={form.counterpartySearchLabel}
        closeLabel={form.closeSheet}
        emptyLabel={form.counterpartyEmpty}
        emptyOptionLabel={form.counterpartyEmptyOption}
        value={model.selectedCounterpartyId}
        options={model.counterpartyOptions}
        searchMaxLength={LIST_COUNTERPARTIES_SEARCH_MAX}
        onClose={model.closeCounterpartySheet}
        onChange={model.pickCounterparty}
      />
      <DocumentHandoverSheet
        visible={model.handoverVisible}
        title={model.handoverTitle}
        url={model.handoverUrl}
        copy={model.copy}
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
        onPrint={model.printHandover}
      />
    </SafeAreaView>
  );
}

function DocumentFormBody(props: { readonly model: DocumentFormModel }) {
  const { model } = props;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = model.copy.form;

  switch (model.state.kind) {
    case "error":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<WifiOffIcon size={theme.iconSize.md} color={iconColor} />}
            title={model.copy.empty.errorTitle}
            description={form.errors.unavailable}
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={form.permissionCreateTitle}
            description={form.permissionCreateDescription}
          />
        </CenteredEmpty>
      );
    case "ready":
      return <DocumentFormReady model={model} />;
  }
}

function DocumentFormReady(props: { readonly model: DocumentFormModel }) {
  const { model } = props;
  const { theme } = useUnistyles();
  const form = model.copy.form;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      {model.banner !== null ? <Banner message={model.banner} /> : null}
      <EditorSection title={form.typeSectionTitle}>
        <DocumentTypeCards
          copy={form}
          value={model.type}
          disabled={!model.fieldsEditable}
          onChange={model.setType}
        />
      </EditorSection>
      <EditorSection title={form.orderSectionTitle}>
        <SelectorRow
          label={form.orderLabel}
          value={model.orderValue}
          subtitle={model.orderSubtitle}
          placeholder={form.orderPlaceholder}
          icon={
            <FileTextIcon
              size={theme.iconSize.sm}
              color={theme.colors.mutedForeground}
            />
          }
          error={model.orderError}
          disabled={!model.fieldsEditable}
          onPress={model.openOrderSheet}
        />
      </EditorSection>
      <EditorSection title={form.counterpartySectionTitle}>
        <SelectorRow
          label={form.counterpartyLabel}
          value={model.counterpartyValue}
          subtitle={model.counterpartySubtitle}
          placeholder={
            model.counterpartyEnabled
              ? form.counterpartyPlaceholder
              : form.counterpartyDisabledPlaceholder
          }
          icon={
            <UserIcon
              size={theme.iconSize.sm}
              color={theme.colors.mutedForeground}
            />
          }
          disabled={!model.fieldsEditable || !model.counterpartyEnabled}
          onPress={model.openCounterpartySheet}
        />
      </EditorSection>
    </KeyboardAwareScrollView>
  );
}

function CenteredEmpty(props: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{props.children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  footerDock: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  footerCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  footerActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
}));
