import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CameraIcon,
  ImagePlusIcon,
  XIcon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { interpolate } from "../../../i18n/locale";
import type { ProductsPhotosCopy } from "../../../i18n/products";
import { Banner } from "../../ui";
import type { PhotoTileView } from "./product-photos-model";

/** Canvas `h-40 w-40` product photo tile. Feature size, not a theme token. */
const PHOTO_TILE = 160;

/**
 * Feature photo strip (SHO-153). Canvas `ProductImagePicker`: 160px
 * tiles, cover on the first, overlay upload/fail, dashed add tile.
 * Reorder is explicit earlier/later controls. Camera/library picking
 * is a Sheet on the parent (sheets, not dropdowns).
 */
export function ProductImagePicker(props: {
  readonly tiles: readonly PhotoTileView[];
  readonly copy: ProductsPhotosCopy;
  readonly previewByFileId: ReadonlyMap<string, string>;
  readonly canAdd: boolean;
  readonly readOnly?: boolean;
  readonly showHeading?: boolean;
  readonly banner?: string | null;
  readonly onAdd?: () => void;
  readonly onRemove?: (id: string) => void;
  readonly onMoveEarlier?: (id: string) => void;
  readonly onMoveLater?: (id: string) => void;
  readonly onRetry?: (id: string) => void;
  readonly onCancel?: (id: string) => void;
}) {
  const readOnly = props.readOnly === true;
  const showHeading = props.showHeading === true;
  const banner =
    props.banner !== undefined &&
    props.banner !== null &&
    props.banner.length > 0
      ? props.banner
      : null;

  return (
    <View style={styles.root}>
      {showHeading ? (
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{props.copy.heading}</Text>
          <Text style={styles.count}>
            {interpolate(props.copy.count, {
              count: String(props.tiles.length),
            })}
          </Text>
        </View>
      ) : null}
      {banner !== null ? <Banner message={banner} /> : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {props.tiles.map((tile) => (
          <PhotoTile
            key={tile.id}
            tile={tile}
            copy={props.copy}
            readOnly={readOnly}
            previewUrl={
              tile.fileId === null
                ? null
                : (props.previewByFileId.get(tile.fileId) ?? null)
            }
            onRemove={props.onRemove}
            onMoveEarlier={props.onMoveEarlier}
            onMoveLater={props.onMoveLater}
            onRetry={props.onRetry}
            onCancel={props.onCancel}
          />
        ))}
        {!readOnly && props.canAdd && props.onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.copy.addLabel}
            onPress={props.onAdd}
            style={({ pressed }) => [
              styles.addCell,
              pressed ? styles.pressed : null,
            ]}
          >
            <AddTileBody copy={props.copy} />
          </Pressable>
        ) : null}
      </ScrollView>
      <Text style={styles.hint}>{props.copy.hint}</Text>
    </View>
  );
}

export function photoCountLabel(template: string, count: number): string {
  return interpolate(template, { count: String(count) });
}

function AddTileBody(props: { readonly copy: ProductsPhotosCopy }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.addBody}>
      <ImagePlusIcon
        size={theme.iconSize.md}
        color={theme.colors.mutedForeground}
      />
      <Text style={styles.addLabel}>{props.copy.addLabel}</Text>
    </View>
  );
}

function PhotoTile(props: {
  readonly tile: PhotoTileView;
  readonly copy: ProductsPhotosCopy;
  readonly previewUrl: string | null;
  readonly readOnly: boolean;
  readonly onRemove: ((id: string) => void) | undefined;
  readonly onMoveEarlier: ((id: string) => void) | undefined;
  readonly onMoveLater: ((id: string) => void) | undefined;
  readonly onRetry: ((id: string) => void) | undefined;
  readonly onCancel: ((id: string) => void) | undefined;
}) {
  const { tile, copy } = props;
  const { theme } = useUnistyles();
  const source = tile.localUri !== null ? tile.localUri : props.previewUrl;
  const showProgress = tile.phase === "uploading";
  const showFailed = tile.phase === "failed";
  const ink = theme.colors.foreground;
  const onPrimary = theme.colors.primaryForeground;

  return (
    <View style={styles.cell}>
      {source === null ? (
        <View style={styles.placeholder}>
          <CameraIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        </View>
      ) : (
        <Image
          source={{ uri: source }}
          recyclingKey={tile.fileId ?? tile.id}
          contentFit="cover"
          cachePolicy="memory"
          transition={150}
          style={styles.image}
        />
      )}
      {tile.isCover ? (
        <View style={styles.cover}>
          <Text style={styles.coverLabel}>{copy.coverLabel}</Text>
        </View>
      ) : null}
      {!props.readOnly ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            tile.canCancel ? copy.cancelUpload : copy.removeLabel
          }
          onPress={() => {
            if (tile.canCancel) {
              props.onCancel?.(tile.id);
              return;
            }
            props.onRemove?.(tile.id);
          }}
          style={({ pressed }) => [
            styles.overlayHit,
            styles.removeHit,
            pressed ? styles.pressed : null,
          ]}
        >
          <XIcon size={theme.iconSize.sm} color={ink} />
        </Pressable>
      ) : null}
      {!props.readOnly ? (
        <View style={styles.moveRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.moveEarlier}
            disabled={!tile.canMoveEarlier}
            onPress={() => {
              props.onMoveEarlier?.(tile.id);
            }}
            style={({ pressed }) => [
              styles.overlayHit,
              pressed ? styles.pressed : null,
            ]}
          >
            <ArrowLeftIcon
              size={theme.iconSize.sm}
              color={tile.canMoveEarlier ? ink : theme.colors.icon.muted}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.moveLater}
            disabled={!tile.canMoveLater}
            onPress={() => {
              props.onMoveLater?.(tile.id);
            }}
            style={({ pressed }) => [
              styles.overlayHit,
              pressed ? styles.pressed : null,
            ]}
          >
            <ArrowRightIcon
              size={theme.iconSize.sm}
              color={tile.canMoveLater ? ink : theme.colors.icon.muted}
            />
          </Pressable>
        </View>
      ) : null}
      {showProgress ? (
        <View style={styles.overlay} accessibilityLabel={copy.uploadingLabel}>
          <ActivityIndicator color={theme.colors.activityIndicator.onPrimary} />
          <Text style={styles.overlayLabel}>{copy.uploadingLabel}</Text>
          {!props.readOnly && tile.canCancel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.cancelUpload}
              onPress={() => {
                props.onCancel?.(tile.id);
              }}
              style={({ pressed }) => [
                styles.cancelChip,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.cancelChipLabel}>{copy.cancelUpload}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showFailed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.retryLabel}
          disabled={props.readOnly}
          onPress={() => {
            props.onRetry?.(tile.id);
          }}
          style={styles.overlay}
        >
          <AlertCircleIcon size={theme.iconSize.md} color={onPrimary} />
          <Text style={styles.overlayLabel}>{copy.failedLabel}</Text>
          {!props.readOnly ? (
            <Text style={styles.overlayActionLabel}>{copy.retryLabel}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.sm,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  heading: {
    flexShrink: 1,
    color: theme.colors.foreground,
    fontSize: theme.typography.base.fontSize,
    lineHeight: theme.typography.base.lineHeight,
    fontWeight: "600",
  },
  count: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontVariant: ["tabular-nums"],
  },
  strip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing["2xs"],
  },
  cell: {
    width: PHOTO_TILE,
    height: PHOTO_TILE,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addCell: {
    width: PHOTO_TILE,
    height: PHOTO_TILE,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.icon.muted,
    backgroundColor: theme.colors.background,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.muted,
  },
  addBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  addLabel: {
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "500",
  },
  cover: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  coverLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography["2xs"].fontSize,
    lineHeight: theme.typography["2xs"].lineHeight,
    fontWeight: "500",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  overlayLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
    textAlign: "center",
  },
  overlayActionLabel: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
  overlayHit: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  removeHit: {
    position: "absolute",
    top: theme.spacing["2xs"],
    right: theme.spacing["2xs"],
  },
  moveRow: {
    position: "absolute",
    right: theme.spacing["2xs"],
    bottom: theme.spacing["2xs"],
    flexDirection: "row",
    gap: theme.spacing["2xs"],
  },
  cancelChip: {
    minHeight: theme.hitTarget.min,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.card,
  },
  cancelChipLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
  },
  hint: {
    color: theme.colors.icon.muted,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  pressed: {
    opacity: 0.85,
  },
}));
