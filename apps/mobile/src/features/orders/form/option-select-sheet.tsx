import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckIcon, UserIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { SearchField, Sheet } from "../../../components/ui";
import {
  filterOptionSelectItems,
  type OptionSelectItem,
} from "./option-select";

/**
 * Canvas picker chrome (customers `ClientSelectSheet`). Stays
 * single-select. Products and variants use `ProductSelectSheet` so
 * variant drill-down never stacks a second Modal.
 * `mode="content"` is the scrollable picker body without confirm-action chrome.
 */
export function OptionSelectSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly searchPlaceholder: string;
  readonly searchLabel: string;
  readonly closeLabel: string;
  readonly emptyLabel: string;
  readonly value: string | null;
  readonly selectedIds?: ReadonlySet<string> | undefined;
  readonly options: readonly OptionSelectItem[];
  readonly searchMaxLength: number;
  readonly leading?: "user" | undefined;
  readonly onClose: () => void;
  readonly onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!props.visible) {
      setQuery("");
    }
  }, [props.visible]);

  const filtered = filterOptionSelectItems(props.options, query);

  return (
    <Sheet
      visible={props.visible}
      title={props.title}
      onClose={props.onClose}
      mode="content"
      fullHeight
      closeAccessibilityLabel={props.closeLabel}
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
          filtered.map((option) => (
            <OptionRow
              key={option.id}
              label={option.name}
              description={option.description}
              selected={
                props.selectedIds !== undefined
                  ? props.selectedIds.has(option.id)
                  : option.id === props.value
              }
              leading={props.leading}
              onPress={() => {
                props.onChange(option.id);
              }}
            />
          ))
        )}
      </View>
    </Sheet>
  );
}

function OptionRow(props: {
  readonly label: string;
  readonly description?: string | undefined;
  readonly selected: boolean;
  readonly leading?: "user" | undefined;
  readonly onPress: () => void;
}) {
  const { theme } = useUnistyles();
  const description =
    props.description != null && props.description.length > 0
      ? props.description
      : null;
  const a11yLabel =
    description !== null ? `${props.label}, ${description}` : props.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.option,
        props.selected ? styles.optionSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {props.leading === "user" ? (
        <View style={styles.avatar}>
          <UserIcon size={theme.iconSize.md} color={theme.colors.accent} />
        </View>
      ) : null}
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{props.label}</Text>
        {description !== null ? (
          <Text style={styles.optionDescription}>{description}</Text>
        ) : null}
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
  avatar: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
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
  check: {
    // Canvas h-7 (28) — Class B from spacing, not a raw pixel.
    width: theme.spacing["2xl"] + theme.spacing.xs,
    height: theme.spacing["2xl"] + theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDescription: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  pressed: {
    opacity: 0.85,
  },
}));
