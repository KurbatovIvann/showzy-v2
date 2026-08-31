import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckIcon, ChevronRightIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, SearchField, Sheet } from "../../../components/ui";
import { interpolate } from "../../../i18n/locale";
import { OrderThumbnail } from "../shared/order-thumbnail";
import type {
  ProductSelectLevel,
  ProductSelectRow,
  ProductSelectVariantRow,
  ProductVariantsLoadStatus,
} from "./product-select";

/**
 * Canvas `ProductSelectSheet`: multi-toggle, ink check, 44×44 thumbnail,
 * confirm footer. Variant drill-down replaces the product list in the
 * same Modal (SHO-249) — never a second Sheet.
 */
export function ProductSelectSheet(props: {
  readonly visible: boolean;
  readonly sessionOpen: boolean;
  readonly level: ProductSelectLevel;
  readonly title: string;
  readonly variantsTitle: string;
  readonly searchPlaceholder: string;
  readonly searchLabel: string;
  readonly closeLabel: string;
  readonly backLabel: string;
  readonly emptyLabel: string;
  readonly variantsLoadingLabel: string;
  readonly variantsEmptyLabel: string;
  readonly variantsErrorLabel: string;
  readonly doneLabel: string;
  readonly thumbnailFailedLabel: string;
  readonly searchMaxLength: number;
  readonly selectedIds: ReadonlySet<string>;
  readonly selectedVariantIds: ReadonlySet<string>;
  readonly doneCount: number;
  readonly products: readonly ProductSelectRow[];
  readonly variants: readonly ProductSelectVariantRow[];
  readonly variantsStatus: ProductVariantsLoadStatus;
  readonly onClose: () => void;
  readonly onBack: () => void;
  readonly onToggle: (productId: string) => void;
  readonly onToggleVariant: (variantId: string) => void;
  readonly onConfirm: () => void;
}) {
  const [query, setQuery] = useState("");
  const variantsOpen = props.level === "variants";

  // Reset search when the picker session ends, not when variants open.
  useEffect(() => {
    if (!props.sessionOpen) {
      setQuery("");
    }
  }, [props.sessionOpen]);

  const normalized = query.trim().toLowerCase();
  const filtered =
    normalized.length === 0
      ? props.products
      : props.products.filter((product) =>
          product.name.toLowerCase().includes(normalized),
        );

  return (
    <Sheet
      visible={props.visible}
      title={variantsOpen ? props.variantsTitle : props.title}
      onClose={props.onClose}
      mode="content"
      fullHeight
      closeAccessibilityLabel={props.closeLabel}
      back={
        variantsOpen
          ? {
              onPress: props.onBack,
              accessibilityLabel: props.backLabel,
            }
          : undefined
      }
      footer={
        <Button
          fullWidth
          label={interpolate(props.doneLabel, {
            count: String(props.doneCount),
          })}
          onPress={props.onConfirm}
        />
      }
    >
      {variantsOpen ? (
        <VariantsLevel
          variants={props.variants}
          status={props.variantsStatus}
          selectedIds={props.selectedVariantIds}
          loadingLabel={props.variantsLoadingLabel}
          emptyLabel={props.variantsEmptyLabel}
          errorLabel={props.variantsErrorLabel}
          onToggle={props.onToggleVariant}
        />
      ) : (
        <>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={props.searchPlaceholder}
            accessibilityLabel={props.searchLabel}
            maxLength={props.searchMaxLength}
          />
          <View style={styles.list}>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{props.emptyLabel}</Text>
            ) : (
              filtered.map((product) => (
                <ProductPickerRow
                  key={product.id}
                  product={product}
                  selected={props.selectedIds.has(product.id)}
                  failedLabel={props.thumbnailFailedLabel}
                  onPress={() => {
                    props.onToggle(product.id);
                  }}
                />
              ))
            )}
          </View>
        </>
      )}
    </Sheet>
  );
}

function VariantsLevel(props: {
  readonly variants: readonly ProductSelectVariantRow[];
  readonly status: ProductVariantsLoadStatus;
  readonly selectedIds: ReadonlySet<string>;
  readonly loadingLabel: string;
  readonly emptyLabel: string;
  readonly errorLabel: string;
  readonly onToggle: (variantId: string) => void;
}) {
  if (props.status === "loading" || props.status === "idle") {
    return <Text style={styles.empty}>{props.loadingLabel}</Text>;
  }
  if (props.status === "error") {
    return <Text style={styles.empty}>{props.errorLabel}</Text>;
  }
  if (props.variants.length === 0) {
    return <Text style={styles.empty}>{props.emptyLabel}</Text>;
  }
  return (
    <View style={styles.list}>
      {props.variants.map((variant) => (
        <VariantPickerRow
          key={variant.id}
          name={variant.name}
          selected={props.selectedIds.has(variant.id)}
          onPress={() => {
            props.onToggle(variant.id);
          }}
        />
      ))}
    </View>
  );
}

function ProductPickerRow(props: {
  readonly product: ProductSelectRow;
  readonly selected: boolean;
  readonly failedLabel: string;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const { product } = props;
  const showCheck = props.selected;
  const showChevron = product.hasVariants;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={product.name}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.option,
        props.selected ? styles.optionSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <OrderThumbnail
        fileId={product.thumbnailFileId}
        url={product.thumbnailUrl}
        failed={product.thumbnailFailed}
        failedLabel={props.failedLabel}
      />
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{product.name}</Text>
        <Text style={styles.optionDescription}>{product.variantsLabel}</Text>
      </View>
      {showCheck ? (
        <View style={styles.check}>
          <CheckIcon
            size={theme.iconSize.sm}
            color={theme.colors.primaryForeground}
          />
        </View>
      ) : null}
      {showChevron ? (
        <ChevronRightIcon
          size={theme.iconSize.sm}
          color={theme.colors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

function VariantPickerRow(props: {
  readonly name: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.name}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.option,
        props.selected ? styles.optionSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{props.name}</Text>
      </View>
      {props.selected ? (
        <View style={styles.check}>
          <CheckIcon
            size={theme.iconSize.sm}
            color={theme.colors.primaryForeground}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.spacing.sm,
  },
  empty: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    paddingVertical: theme.spacing.md,
  },
  option: {
    minHeight: theme.hitTarget.row - theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  optionSelected: {
    borderColor: theme.colors.foreground,
    backgroundColor: theme.colors.inputFill,
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing["2xs"],
  },
  optionLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  optionDescription: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  check: {
    // Canvas h-7 (28) — Class B from spacing, not a raw pixel.
    width: theme.spacing["2xl"] + theme.spacing.xs,
    height: theme.spacing["2xl"] + theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
}));
