import { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { ImageOffIcon, PackageIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * 44×44 signed thumbnail from a parent-batched `files.getDownloadUrls`
 * query (SHO-242). Copied from catalog `ProductThumbnail` usage — orders
 * must not import `features/catalog`. `fileId: null` or a missing URL
 * renders `PackageIcon` without a request. A download-query failure is
 * a distinct `failed` path. The URL is never persisted.
 */
export const OrderThumbnail = memo(function OrderThumbnail(props: {
  readonly fileId: string | null;
  readonly url: string | null;
  readonly failed: boolean;
  readonly failedLabel: string;
}) {
  const { theme } = useUnistyles();
  const url = props.url;
  const failed = props.failed;
  const iconColor = theme.colors.mutedForeground;

  return (
    <View
      style={styles.frame}
      accessibilityLabel={failed ? props.failedLabel : undefined}
    >
      {failed ? (
        <ImageOffIcon size={theme.iconSize.sm} color={iconColor} />
      ) : url === null ? (
        <PackageIcon size={theme.iconSize.sm} color={iconColor} />
      ) : (
        <Image
          source={{ uri: url }}
          recyclingKey={props.fileId}
          contentFit="cover"
          transition={150}
          style={styles.image}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  frame: {
    width: theme.hitTarget.min,
    height: theme.hitTarget.min,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputFill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
}));
