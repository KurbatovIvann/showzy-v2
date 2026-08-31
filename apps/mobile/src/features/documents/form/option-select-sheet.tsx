import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { SearchField, Sheet } from "../../../components/ui";
import {
  filterOptionSelectItems,
  type OptionSelectItem,
} from "./option-select";

/**
 * Canvas picker chrome copied from orders / customers. Optional empty
 * inherit row is for the counterparty picker ("customer name only").
 * `mode="content"` is the scrollable picker body without confirm-action chrome.
 */
export function OptionSelectSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly searchPlaceholder: string;
  readonly searchLabel: string;
  readonly closeLabel: string;
  readonly emptyLabel: string;
  readonly emptyOptionLabel?: string | undefined;
  readonly value: string | null;
  readonly options: readonly OptionSelectItem[];
  readonly searchMaxLength: number;
  readonly onClose: () => void;
  readonly onChange: (value: string | null) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!props.visible) {
      setQuery("");
    }
  }, [props.visible]);

  const filtered = filterOptionSelectItems(props.options, query);
  const emptyOptionLabel = props.emptyOptionLabel;

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
        {emptyOptionLabel != null && emptyOptionLabel.length > 0 ? (
          <OptionRow
            label={emptyOptionLabel}
            selected={props.value === null}
            onPress={() => {
              props.onChange(null);
            }}
          />
        ) : null}
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{props.emptyLabel}</Text>
        ) : (
          filtered.map((option) => (
            <OptionRow
              key={option.id}
              label={option.name}
              description={option.description}
              selected={option.id === props.value}
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
