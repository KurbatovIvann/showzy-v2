import type { Control } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { FileTextIcon, ReceiptIcon, TruckIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { FormTextField } from "../../../components/form-kit";
import type { DocumentsFormCopy } from "../../../i18n/documents";
import {
  DOCUMENT_BASIS_LINES,
  DOCUMENT_BASIS_MAX,
} from "../shared/document-caps";
import type { DocumentFormDraft } from "./document-form-draft";
import type { DocumentFormLayoutCard } from "./document-form.presenter";
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

/**
 * System look cards from `docGeneration.listLayouts`. Static label is
 * the preview — do not render react-pdf or fetch a PDF before create.
 */
export function DocumentLayoutCards(props: {
  readonly copy: DocumentsFormCopy;
  readonly cards: readonly DocumentFormLayoutCard[];
  readonly value: string;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly error: string | null;
  readonly preview: string | null;
  readonly onRetry: () => void;
  readonly onChange: (key: string) => void;
}) {
  if (props.loading) {
    return <Text style={styles.meta}>{props.copy.layoutLoading}</Text>;
  }
  if (props.failed) {
    return (
      <View style={styles.stack}>
        <Text style={styles.meta}>{props.copy.layoutError}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.copy.layoutRetry}
          disabled={props.disabled}
          onPress={props.onRetry}
          style={({ pressed }) => [
            styles.retry,
            pressed && !props.disabled ? styles.pressed : null,
          ]}
        >
          <Text style={styles.retryLabel}>{props.copy.layoutRetry}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        {props.cards.map((card) => (
          <LayoutCard
            key={card.key}
            layoutKey={card.key}
            label={card.label}
            selected={props.value === card.key}
            disabled={props.disabled}
            onChange={props.onChange}
          />
        ))}
      </View>
      {props.preview !== null ? (
        <Text style={styles.meta}>
          {props.copy.layoutPreviewHint}: {props.preview}
        </Text>
      ) : null}
      {props.error !== null ? (
        <Text style={styles.fieldError}>{props.error}</Text>
      ) : null}
    </View>
  );
}

function LayoutCard(props: {
  readonly layoutKey: string;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onChange: (key: string) => void;
}) {
  const { theme } = useUnistyles();
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
        props.onChange(props.layoutKey);
      }}
      style={({ pressed }) => [
        styles.card,
        props.selected ? styles.cardSelected : null,
        pressed && !props.disabled ? styles.pressed : null,
        props.disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.icon}>
        <FileTextIcon size={theme.iconSize.md} color={iconColor} />
      </View>
      <Text style={styles.label}>{props.label}</Text>
    </Pressable>
  );
}

export function DocumentBasisField(props: {
  readonly control: Control<DocumentFormDraft>;
  readonly copy: DocumentsFormCopy;
  readonly editable: boolean;
  readonly error: string | null;
  readonly onFieldEdit: () => void;
}) {
  return (
    <FormTextField
      control={props.control}
      name="basis"
      label={props.copy.basisLabel}
      placeholder={props.copy.basisPlaceholder}
      error={props.error}
      editable={props.editable}
      onFieldEdit={props.onFieldEdit}
      maxLength={DOCUMENT_BASIS_MAX}
      multiline
      numberOfLines={DOCUMENT_BASIS_LINES}
      autoCapitalize="sentences"
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  stack: {
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
  meta: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  fieldError: {
    color: theme.colors.destructive,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
  },
  retryLabel: {
    color: theme.colors.accent,
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
