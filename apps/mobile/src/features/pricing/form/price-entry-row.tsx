import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Controller, type Control } from "react-hook-form";
import { StyleSheet } from "react-native-unistyles";

import { interpolate } from "../../../i18n/locale";
import type { PricingFormCopy } from "../../../i18n/pricing";
import { formatMoneyMinor } from "../../../format/money";
import { StatusPill, TextField } from "../../../components/ui";
import { PRICE_LIST_CURRENCY } from "../shared/price-list-caps";
import { entryPriceRhfPath } from "./price-list-form-copy";
import {
  listPriceDiff,
  priceListFormFieldChanged,
  type PriceDiffTone,
  type PriceListFormDraft,
  type PriceListFormMode,
} from "./price-list-form-draft";

const UAH_SUFFIX = "₴";

/**
 * Canvas `PriceEntryRow`: product/variant name, archived pill, catalog
 * base, money field, display-only % vs catalog. Empty = inherit; `0`
 * is a stored price.
 */
export const PriceEntryRow = memo(function PriceEntryRow(props: {
  readonly control: Control<PriceListFormDraft>;
  readonly fieldIndex: number;
  readonly copy: PricingFormCopy;
  readonly mode: PriceListFormMode;
  readonly name: string;
  readonly archived: boolean;
  readonly kind: "product" | "variant";
  readonly basePriceMinor: string;
  readonly originPriceText: string;
  readonly editable: boolean;
  readonly error: string | null;
  readonly expanded: boolean;
  readonly expanding: boolean;
  readonly showExpand: boolean;
  readonly onFieldEdit: () => void;
  readonly onToggleExpand: (productId: string) => void;
  readonly productId: string;
}) {
  const baseLabel = interpolate(props.copy.catalogBaseLabel, {
    price: formatMoneyMinor(props.basePriceMinor, PRICE_LIST_CURRENCY),
  });
  const accessibilityLabel =
    props.kind === "variant"
      ? `${props.name}. ${props.copy.variantInheritHint}`
      : props.name;

  return (
    <View style={props.kind === "variant" ? styles.variantWrap : null}>
      <Controller
        control={props.control}
        name={entryPriceRhfPath(props.fieldIndex)}
        render={({ field }) => {
          const diff = listPriceDiff({
            priceText: field.value,
            basePriceMinor: props.basePriceMinor,
          });
          const dirty = priceListFormFieldChanged(
            props.mode,
            field.value,
            props.originPriceText,
          );
          return (
            <View style={[styles.card, dirty ? styles.cardDirty : null]}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{props.name}</Text>
                {props.archived ? (
                  <StatusPill label={props.copy.archivedBadge} tone="neutral" />
                ) : null}
              </View>
              <Text style={styles.base}>{baseLabel}</Text>
              {props.kind === "variant" ? (
                <Text style={styles.hint}>{props.copy.variantInheritHint}</Text>
              ) : null}
              <View style={styles.priceRow}>
                <View style={styles.field}>
                  <TextField
                    value={field.value}
                    onChangeText={(value) => {
                      field.onChange(value);
                      props.onFieldEdit();
                    }}
                    placeholder={formatMoneyMinor(
                      props.basePriceMinor,
                      PRICE_LIST_CURRENCY,
                    )}
                    accessibilityLabel={accessibilityLabel}
                    keyboardType="decimal-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    editable={props.editable}
                    suffix={UAH_SUFFIX}
                    error={props.error}
                    changed={dirty}
                    changedLabel={props.copy.changedLabel}
                  />
                </View>
                <Text
                  style={[styles.diff, diffToneStyle(diff.tone)]}
                  accessibilityLabel={diff.label}
                >
                  {diff.label}
                </Text>
              </View>
              {props.showExpand ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    props.expanded
                      ? props.copy.collapseVariants
                      : props.copy.expandVariants
                  }
                  disabled={!props.editable || props.expanding}
                  onPress={() => {
                    props.onToggleExpand(props.productId);
                  }}
                  style={({ pressed }) => [
                    styles.expand,
                    pressed && props.editable ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.expandLabel}>
                    {props.expanding
                      ? props.copy.pricesLoading
                      : props.expanded
                        ? props.copy.collapseVariants
                        : props.copy.expandVariants}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
});

function diffToneStyle(tone: PriceDiffTone) {
  switch (tone) {
    case "down":
      return styles.diffDown;
    case "up":
      return styles.diffUp;
    case "same":
      return styles.diffSame;
    case "empty":
      return styles.diffEmpty;
  }
}

const styles = StyleSheet.create((theme) => ({
  variantWrap: {
    paddingLeft: theme.spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputFill,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardDirty: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  base: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  hint: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  diff: {
    width: theme.spacing["3xl"] + theme.spacing.lg,
    paddingTop: theme.spacing.md,
    textAlign: "right",
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  diffEmpty: {
    color: theme.colors.icon.muted,
  },
  diffDown: {
    color: theme.colors.success,
  },
  diffUp: {
    color: theme.colors.destructive,
  },
  diffSame: {
    color: theme.colors.mutedForeground,
  },
  expand: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
  },
  expandLabel: {
    color: theme.colors.accent,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
}));
