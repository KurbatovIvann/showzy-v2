import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  BanIcon,
  EyeIcon,
  PrinterIcon,
  QrCodeIcon,
  Share2Icon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Banner, Sheet, StatusPill } from "../../../components/ui";
import type { DocumentsCopy } from "../../../i18n/documents";
import {
  documentOptionVisibility,
  type DocumentOptionsGetLoadState,
  type DocumentsListRow,
} from "./documents-list.presenter";

export function DocumentOptionsSheet(props: {
  readonly visible: boolean;
  readonly document: DocumentsListRow | null;
  readonly copy: DocumentsCopy;
  readonly canView: boolean;
  readonly canEdit: boolean;
  readonly getLoad: DocumentOptionsGetLoadState["kind"];
  readonly generationStatus: "pending" | "ready" | "failed" | null;
  readonly pdfDownloadUrl: string | null;
  readonly onClose: () => void;
  readonly onHidden: () => void;
  readonly onShare: () => void;
  readonly onQr: () => void;
  readonly onPrint: () => void;
  readonly onOpenPdf: () => void;
  readonly onCancel: () => void;
}) {
  const { theme } = useUnistyles();
  const document = props.document;
  const visibility =
    document === null
      ? documentOptionVisibility({
          canView: false,
          canEdit: false,
          status: "issued",
          getLoad: "idle",
          generationStatus: null,
          pdfDownloadUrl: null,
        })
      : documentOptionVisibility({
          canView: props.canView,
          canEdit: props.canEdit,
          status: document.status,
          getLoad: props.getLoad,
          generationStatus: props.generationStatus,
          pdfDownloadUrl: props.pdfDownloadUrl,
        });
  const muted = theme.colors.mutedForeground;
  const danger = theme.colors.destructive;
  const icon = theme.iconSize.sm;
  const generationLabel =
    props.getLoad === "ready" && props.generationStatus !== null
      ? props.copy.generation[props.generationStatus]
      : null;
  const generationTone =
    props.generationStatus === "ready"
      ? "success"
      : props.generationStatus === "failed"
        ? "danger"
        : "attention";
  const getBanner =
    props.getLoad === "offline"
      ? props.copy.optionsGet.offline
      : props.getLoad === "error"
        ? props.copy.optionsGet.error
        : null;
  const pdfEnabled = visibility.pdfReady;
  const openPdfEnabled = visibility.openPdfEnabled;
  const showShare = visibility.showShare;
  const showQr = visibility.showQr;
  const showPrint = visibility.showPrint;
  const showOpenPdf = visibility.showOpenPdf;
  const showCancel = visibility.showCancel;

  return (
    <Sheet
      visible={props.visible}
      title={document?.documentNumber ?? props.copy.options.close}
      closeAccessibilityLabel={props.copy.options.close}
      onClose={props.onClose}
      onHidden={props.onHidden}
    >
      {props.getLoad === "loading" ? (
        <View style={styles.generation}>
          <StatusPill label={props.copy.optionsGet.loading} tone="attention" />
        </View>
      ) : null}
      {getBanner !== null ? (
        <View style={styles.generation}>
          <Banner message={getBanner} />
        </View>
      ) : null}
      {generationLabel !== null ? (
        <View style={styles.generation}>
          <StatusPill label={generationLabel} tone={generationTone} />
        </View>
      ) : null}
      <View style={styles.group}>
        {showShare ? (
          <OptionRow
            icon={<Share2Icon size={icon} color={muted} />}
            label={props.copy.options.share}
            last={!showQr && !showPrint && !showOpenPdf && !showCancel}
            onPress={props.onShare}
          />
        ) : null}
        {showQr ? (
          <OptionRow
            icon={<QrCodeIcon size={icon} color={muted} />}
            label={props.copy.options.qr}
            last={!showPrint && !showOpenPdf && !showCancel}
            onPress={props.onQr}
          />
        ) : null}
        {showPrint ? (
          <OptionRow
            icon={<PrinterIcon size={icon} color={muted} />}
            label={props.copy.options.print}
            disabled={!pdfEnabled}
            last={!showOpenPdf && !showCancel}
            onPress={props.onPrint}
          />
        ) : null}
        {showOpenPdf ? (
          <OptionRow
            icon={<EyeIcon size={icon} color={muted} />}
            label={props.copy.options.openPdf}
            disabled={!openPdfEnabled}
            last={!showCancel}
            onPress={props.onOpenPdf}
          />
        ) : null}
        {showCancel ? (
          <OptionRow
            icon={<BanIcon size={icon} color={danger} />}
            label={props.copy.options.cancel}
            danger
            last
            onPress={props.onCancel}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function OptionRow(props: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
  readonly last?: boolean;
  readonly disabled?: boolean;
}) {
  const danger = props.danger === true;
  const disabled = props.disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.row,
        props.last === true ? styles.rowLast : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      {props.icon}
      <Text style={danger ? styles.dangerLabel : styles.label}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  generation: {
    marginBottom: theme.spacing.md,
  },
  group: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    ...theme.squircle,
    backgroundColor: theme.colors.background,
  },
  row: {
    minHeight: theme.hitTarget.field,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  label: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  dangerLabel: {
    flex: 1,
    color: theme.colors.destructive,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.85,
  },
}));
