import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  LayersIcon,
  LockIcon,
  TagIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Banner, Button, EmptyState } from "../../../components/ui";
import { OptionSelectSheet } from "../shared/option-select-sheet";
import { SelectorRow } from "../shared/selector-row";
import {
  GroupFormDescriptionField,
  GroupFormNameField,
} from "./group-form-fields";
import type { GroupFormModel } from "./use-group-form";

export function GroupFormView(model: GroupFormModel) {
  const { copy } = model;
  const form = copy.groupForm;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      accessibilityLabel={model.headerTitle}
      style={styles.screen}
    >
      <AppHeader
        title={model.headerTitle}
        back={{
          onPress: model.requestLeave,
          accessibilityLabel: copy.backLabel,
        }}
      />
      <GroupFormBody model={model} />
      {model.state.kind === "ready" ? (
        <View style={styles.footer}>
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
      ) : null}
      <OptionSelectSheet
        visible={model.pickerOpen}
        title={form.priceListSheetTitle}
        emptyOptionLabel={form.priceListEmptyOption}
        searchPlaceholder={form.priceListSearchPlaceholder}
        searchLabel={copy.searchLabel}
        closeLabel={form.closeSheet}
        value={model.priceListId}
        options={model.priceListOptions}
        onClose={model.closePicker}
        onChange={model.selectPriceList}
      />
    </SafeAreaView>
  );
}

function GroupFormBody(props: { readonly model: GroupFormModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;
  const form = copy.groupForm;

  switch (model.state.kind) {
    case "loading":
      return (
        <View style={styles.skeletons} accessibilityLabel={form.loadingLabel}>
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={[styles.skeletonLine, styles.skeletonPrice]} />
          <View style={styles.skeletonCard} />
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
              model.mode === "edit" ? (
                <Button
                  variant="secondary"
                  label={copy.empty.retry}
                  onPress={model.retry}
                />
              ) : undefined
            }
          />
        </CenteredEmpty>
      );
    case "not-found":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LayersIcon size={theme.iconSize.md} color={iconColor} />}
            title={form.notFoundTitle}
            description={form.notFoundDescription}
          />
        </CenteredEmpty>
      );
    case "permission":
      return (
        <CenteredEmpty>
          <EmptyState
            icon={<LockIcon size={theme.iconSize.md} color={iconColor} />}
            title={
              model.mode === "create"
                ? form.permissionCreateTitle
                : form.permissionEditTitle
            }
            description={
              model.mode === "create"
                ? form.permissionCreateDescription
                : form.permissionEditDescription
            }
          />
        </CenteredEmpty>
      );
    case "ready":
      return <GroupFormReady model={model} />;
  }
}

function GroupFormReady(props: { readonly model: GroupFormModel }) {
  const { model } = props;
  const { copy } = model;
  const form = copy.groupForm;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={theme.spacing.lg}
    >
      <GroupFormSection title={form.aboutTitle}>
        <GroupFormNameField
          control={model.control}
          copy={form}
          mode={model.mode}
          originName={model.originName}
          editable={model.fieldsEditable}
          error={model.nameError}
          onFieldEdit={model.onFieldEdit}
        />
        <GroupFormDescriptionField
          control={model.control}
          copy={form}
          mode={model.mode}
          originDescription={model.originDescription}
          editable={model.fieldsEditable}
          error={model.descriptionError}
          onFieldEdit={model.onFieldEdit}
        />
        {model.memberHint !== null ? (
          <Text style={styles.hint}>{model.memberHint}</Text>
        ) : null}
      </GroupFormSection>
      <GroupFormSection title={form.termsTitle}>
        <SelectorRow
          label={form.priceListLabel}
          value={model.priceListValue}
          placeholder={form.priceListPlaceholder}
          icon={<TagIcon size={theme.iconSize.sm} color={iconColor} />}
          changed={model.priceListChanged}
          changedLabel={form.changedLabel}
          disabled={!model.fieldsEditable}
          onPress={model.openPriceListPicker}
        />
      </GroupFormSection>
      {model.banner !== null && model.banner.length > 0 ? (
        <Banner message={model.banner} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

function GroupFormSection(props: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <View style={styles.sectionCard}>{props.children}</View>
    </View>
  );
}

function CenteredEmpty({ children }: { readonly children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
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
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  hint: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
  skeletons: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skeletonLine: {
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonName: {
    height: theme.hitTarget.field,
    width: "100%",
  },
  skeletonPrice: {
    height: theme.hitTarget.field,
    width: "60%",
  },
  skeletonCard: {
    height: theme.hitTarget.row,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.skeleton,
  },
}));
