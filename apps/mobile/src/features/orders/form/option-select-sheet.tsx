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
 * Canvas picker chrome (customers `OptionSelectSheet` shape): full-height
 * search + rows. No inherit/empty option — create requires a pick.
 * `footer={null}` is content mode without confirm-action chrome.
 */
export function OptionSelectSheet(props: {
  readonly visible: boolean;
  readonly title: string;
  readonly searchPlaceholder: string;
  readonly searchLabel: string;
  readonly closeLabel: string;
  readonly emptyLabel: string;
  readonly value: string | null;
  readonly options: readonly OptionSelectItem[];
  readonly searchMaxLength: number;
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
      footer={null}
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
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
        <CheckIcon size={theme.iconSize.sm} color={theme.colors.success} />
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
    minHeight: theme.hitTarget.min + theme.spacing.md,
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
    fontWeight: "500",
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
