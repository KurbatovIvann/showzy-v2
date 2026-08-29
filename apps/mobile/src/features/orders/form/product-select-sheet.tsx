import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, SearchField, Sheet } from "../../../components/ui";
import { interpolate } from "../../../i18n/locale";
import { OrderThumbnail } from "../shared/order-thumbnail";
import type { ProductSelectRow } from "./product-select";

/**
 * Canvas `ProductSelectSheet`: multi-toggle, ink check, 44×44 thumbnail,
 * confirm footer. Confirm-on-Готово — the sheet stays open across
 * toggles; X discards the in-sheet draft.
 */
export function ProductSelectSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly searchPlaceholder: string;
  readonly searchLabel: string;
  readonly closeLabel: string;
  readonly emptyLabel: string;
  readonly doneLabel: string;
  readonly thumbnailFailedLabel: string;
  readonly searchMaxLength: number;
  readonly selectedIds: ReadonlySet<string>;
  readonly doneCount: number;
  readonly products: readonly ProductSelectRow[];
  readonly onClose: () => void;
  readonly onToggle: (productId: string) => void;
  readonly onConfirm: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!props.visible) {
      setQuery("");
    }
  }, [props.visible]);

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
      title={props.title}
      onClose={props.onClose}
      fullHeight
      closeAccessibilityLabel={props.closeLabel}
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
    </Sheet>
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
