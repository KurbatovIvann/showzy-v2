import { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { PackageIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Signed thumbnail from a parent-batched `files.getDownloadUrls` query
 * (SHO-140). `fileId: null` or a missing URL (no image, loading, batch
 * failure, or a role that cannot read files) renders the package
 * placeholder without a request. `fileId` is only the expo-image recycle
 * key — the URL is never persisted.
 */
export const ProductThumbnail = memo(function ProductThumbnail(props: {
  readonly fileId: string | null;
  readonly url: string | null;
}) {
  const { theme } = useUnistyles();
  const url = props.url;

  return (
    <View style={styles.frame}>
      {url === null ? (
        <PackageIcon
          size={theme.iconSize.md}
          color={theme.colors.mutedForeground}
        />
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
    width: theme.hitTarget.field,
    height: theme.hitTarget.field,
    borderRadius: theme.radii.lg,
    ...theme.squircle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
}));
