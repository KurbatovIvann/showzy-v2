import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import {
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
} from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import type { ProductsPhotosCopy } from "../../../i18n/products";
import { StatusPill } from "../../ui";
import type { PhotoTileView } from "./product-photos-model";

/**
 * Feature photo grid (SHO-141). Canvas `ProductImagePicker`: ordered
 * tiles, cover on the first, add tile, per-image progress. Reorder is
 * explicit earlier/later controls. Camera/library picking is a Sheet
 * on the parent screen (sheets, not dropdowns).
 */
export function ProductImagePicker(props: {
  readonly tiles: readonly PhotoTileView[];
  readonly copy: ProductsPhotosCopy;
  readonly previewByFileId: ReadonlyMap<string, string>;
  readonly canAdd: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
  readonly onMoveEarlier: (id: string) => void;
  readonly onMoveLater: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onCancel: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {props.tiles.map((tile) => (
        <PhotoTile
          key={tile.id}
          tile={tile}
          copy={props.copy}
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
      {props.canAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.copy.addLabel}
          onPress={props.onAdd}
          style={({ pressed }) => [
            styles.cell,
            styles.addCell,
            pressed ? styles.pressed : null,
          ]}
        >
          <AddTileBody copy={props.copy} />
        </Pressable>
      ) : null}
    </View>
  );
}

function AddTileBody(props: { readonly copy: ProductsPhotosCopy }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.addBody}>
      <PlusIcon size={theme.iconSize.md} color={theme.colors.foreground} />
      <Text style={styles.addLabel}>{props.copy.addLabel}</Text>
    </View>
  );
}

function PhotoTile(props: {
  readonly tile: PhotoTileView;
  readonly copy: ProductsPhotosCopy;
  readonly previewUrl: string | null;
  readonly onRemove: (id: string) => void;
  readonly onMoveEarlier: (id: string) => void;
  readonly onMoveLater: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onCancel: (id: string) => void;
}) {
  const { tile, copy } = props;
  const { theme } = useUnistyles();
  const source = tile.localUri !== null ? tile.localUri : props.previewUrl;
  const showProgress = tile.phase === "uploading";
  const showFailed = tile.phase === "failed";

  return (
    <View style={styles.cell}>
      <View style={styles.frame}>
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
            <StatusPill label={copy.coverLabel} tone="action" />
          </View>
        ) : null}
        {showProgress ? (
          <View style={styles.overlay} accessibilityLabel={copy.uploadingLabel}>
            <ActivityIndicator
              color={theme.colors.activityIndicator.onPrimary}
            />
            <Text style={styles.overlayLabel}>
              {`${String(Math.round(tile.progress * 100))}%`}
            </Text>
          </View>
        ) : null}
        {showFailed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.retryLabel}
            onPress={() => {
              props.onRetry(tile.id);
            }}
            style={styles.overlay}
          >
            <Text style={styles.overlayLabel}>{copy.failedLabel}</Text>
            <Text style={styles.overlayActionLabel}>{copy.retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.tileActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.moveEarlier}
          disabled={!tile.canMoveEarlier}
          onPress={() => {
            props.onMoveEarlier(tile.id);
          }}
          style={({ pressed }) => [
            styles.iconHit,
            pressed ? styles.pressed : null,
          ]}
        >
          <ChevronLeftIcon
            size={theme.iconSize.sm}
            color={
              tile.canMoveEarlier
                ? theme.colors.foreground
                : theme.colors.icon.muted
            }
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.moveLater}
          disabled={!tile.canMoveLater}
          onPress={() => {
            props.onMoveLater(tile.id);
          }}
          style={({ pressed }) => [
            styles.iconHit,
            pressed ? styles.pressed : null,
          ]}
        >
          <ChevronRightIcon
            size={theme.iconSize.sm}
            color={
              tile.canMoveLater
                ? theme.colors.foreground
                : theme.colors.icon.muted
            }
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            tile.canCancel ? copy.cancelUpload : copy.removeLabel
          }
          onPress={() => {
            if (tile.canCancel) {
              props.onCancel(tile.id);
              return;
            }
            props.onRemove(tile.id);
          }}
          style={({ pressed }) => [
            styles.iconHit,
            pressed ? styles.pressed : null,
          ]}
        >
          <XIcon size={theme.iconSize.sm} color={theme.colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  cell: {
    width: "30%",
    flexGrow: 1,
    maxWidth: "31.5%",
    gap: theme.spacing.xs,
  },
  addCell: {
    aspectRatio: 1,
    maxWidth: "31.5%",
  },
  frame: {
    aspectRatio: 1,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
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
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  addLabel: {
    color: theme.colors.foreground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
    fontWeight: "600",
  },
  cover: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
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
  tileActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconHit: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
}));
