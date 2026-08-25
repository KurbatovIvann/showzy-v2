import { memo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { PackageIcon } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { useApiClient } from "../../../api/api-provider";
import { fileDownloadUrlQueryOptions } from "../../../api/file-download-query";
import { useActiveCompany } from "../../../api/query-provider";
import {
  classifyProductGallery,
  galleryPageIndex,
} from "./product-detail-model";

/**
 * Product-level gallery: ordered `fileIds` → `files.getDownloadUrl` →
 * `expo-image`. Chatty per-image GETs match the list thumbnail slice
 * (SHO-140 batches later). Empty copy is only for a product with no
 * photos. A no-fetch role still shows that photos exist, without a
 * signed URL. Layout measurement uses a skeleton, never empty copy.
 */
export function ProductGallery(props: {
  readonly fileIds: readonly string[];
  readonly canFetchImages: boolean;
  readonly emptyLabel: string;
  readonly photosLabel: string;
}) {
  const { theme } = useUnistyles();
  const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const ids = props.fileIds;
  const mode = classifyProductGallery({
    fileCount: ids.length,
    canFetchImages: props.canFetchImages,
    pageWidth,
  });

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth === undefined) {
      return;
    }
    setPage(
      galleryPageIndex({
        offsetX: event.nativeEvent.contentOffset.x,
        pageWidth,
        pageCount: ids.length,
      }),
    );
  }

  return (
    <View
      accessibilityLabel={props.photosLabel}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setPageWidth((prev) => (prev === width ? prev : width));
      }}
    >
      {mode === "empty" ? (
        <View style={styles.frame}>
          <PackageIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
          <Text style={styles.empty}>{props.emptyLabel}</Text>
        </View>
      ) : null}
      {mode === "pending-layout" ? (
        <View
          accessibilityElementsHidden
          style={[styles.frame, styles.skeleton]}
        />
      ) : null}
      {mode === "no-fetch" ? (
        <View style={styles.frame}>
          <PackageIcon
            size={theme.iconSize.md}
            color={theme.colors.mutedForeground}
          />
        </View>
      ) : null}
      {mode === "images" && pageWidth !== undefined ? (
        <ScrollView
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScrollEnd}
          showsHorizontalScrollIndicator={false}
          style={[styles.frame, { width: pageWidth }]}
        >
          {ids.map((fileId) => (
            <ProductGalleryImage
              key={fileId}
              fileId={fileId}
              width={pageWidth}
            />
          ))}
        </ScrollView>
      ) : null}
      {mode === "images" && ids.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {ids.map((fileId, index) => (
            <View
              key={fileId}
              style={index === page ? styles.dotActive : styles.dot}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const ProductGalleryImage = memo(function ProductGalleryImage(props: {
  readonly fileId: string;
  readonly width: number;
}) {
  const { theme } = useUnistyles();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const options = fileDownloadUrlQueryOptions({
    client: apiClient,
    companyId: activeCompanyId,
    fileId: props.fileId,
    getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
  });
  const query = useQuery(options);
  const url = query.data?.downloadUrl;

  return (
    <View style={[styles.slide, { width: props.width }]}>
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
          cachePolicy="memory"
          transition={150}
          style={styles.image}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme) => ({
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: theme.radii.card,
    ...theme.squircle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  skeleton: {
    backgroundColor: theme.colors.skeleton,
    borderColor: theme.colors.skeleton,
  },
  slide: {
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  empty: {
    marginTop: theme.spacing.sm,
    color: theme.colors.mutedForeground,
    fontSize: theme.typography.xs.fontSize,
    lineHeight: theme.typography.xs.lineHeight,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  dot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.foreground,
  },
}));
