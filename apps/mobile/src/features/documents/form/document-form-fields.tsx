import { Pressable, Text, View } from "react-native";
import { ReceiptIcon, TruckIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { DocumentsFormCopy } from "../../../i18n/documents";
import type { DocumentFormType } from "./document-form.schema";

/**
 * Canvas DocumentEditor type cards: Рахунок РХ / Видаткова ВН.
 * Not list `ChoiceField` (those are type filters).
 */
export function DocumentTypeCards(props: {
  readonly copy: DocumentsFormCopy;
  readonly value: DocumentFormType;
  readonly disabled: boolean;
  readonly onChange: (value: DocumentFormType) => void;
}) {
  return (
    <View style={styles.row}>
      <TypeCard
        type="payment_invoice"
        label={props.copy.typePaymentInvoice}
        selected={props.value === "payment_invoice"}
        disabled={props.disabled}
        onChange={props.onChange}
      />
      <TypeCard
        type="delivery_note"
        label={props.copy.typeDeliveryNote}
        selected={props.value === "delivery_note"}
        disabled={props.disabled}
        onChange={props.onChange}
      />
    </View>
  );
}

function TypeCard(props: {
  readonly type: DocumentFormType;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: DocumentFormType) => void;
}) {
  const { theme } = useUnistyles();
  const Icon = props.type === "payment_invoice" ? ReceiptIcon : TruckIcon;
  const iconColor = props.selected
    ? theme.colors.primary
    : theme.colors.mutedForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{
        selected: props.selected,
        disabled: props.disabled,
      }}
      disabled={props.disabled}
      onPress={() => {
        props.onChange(props.type);
      }}
      style={({ pressed }) => [
        styles.card,
        props.selected ? styles.cardSelected : null,
        pressed && !props.disabled ? styles.pressed : null,
        props.disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.icon}>
        <Icon size={theme.iconSize.md} color={iconColor} />
      </View>
      <Text style={styles.label}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  card: {
    flex: 1,
    minHeight: theme.hitTarget.row,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  cardSelected: {
    borderColor: theme.colors.foreground,
    backgroundColor: theme.colors.inputFill,
  },
  icon: {
    width: theme.spacing["2xl"] + theme.spacing.md,
    height: theme.spacing["2xl"] + theme.spacing.md,
    borderRadius: theme.radii.md,
    ...theme.squircle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
  },
  label: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
}));
