import { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { PackageIcon } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useApiClient } from "../../../api/api-provider";
import { fileDownloadUrlQueryOptions } from "../../../api/file-download-query";
import { useActiveCompany } from "../../../api/query-provider";

/**
 * Per-row signed thumbnail: `files.getDownloadUrl` → `expo-image`.
 * Accepted as chatty for this slice (SHO-137); the batch URL action is
 * the files follow-up (SHO-140). `fileId: null` (no image, or the role
 * cannot read files) renders the package placeholder without a request.
 */
export const ProductThumbnail = memo(function ProductThumbnail(props: {
  readonly fileId: string | null;
}) {
  const { theme } = useUnistyles();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const options = fileDownloadUrlQueryOptions({
    client: apiClient,
    companyId: activeCompanyId,
    fileId: props.fileId ?? "",
    getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
  });
  const query = useQuery({
    ...options,
    enabled: options.enabled && props.fileId !== null,
  });

  const url = query.data?.downloadUrl;
  return (
    <View style={styles.frame}>
      {url === undefined ? (
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
