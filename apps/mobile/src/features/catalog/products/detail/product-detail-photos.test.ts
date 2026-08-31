import { describe, expect, it } from "vitest";

import { createShowzyQueryClient } from "../../../../api/query-client";
import { contractQueryKey } from "../../../../api/query-options";
import {
  GET_DOWNLOAD_URLS_ACTION,
  type FileDownloadClient,
} from "../../../../api/file-download-query";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
} from "../shared/product-permissions";
import { PRODUCT_PHOTOS_STRIP_RENDITION } from "../photos/product-photos-model";
import {
  detailViewerPhotoTiles,
  imageFileIdsFromGetProduct,
  photoManagerInputFromDetailQuery,
  productDetailViewerDownloadQueryOptions,
} from "./product-detail-photos";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const FILE_A = "44444444-4444-4444-8444-444444444444";
const FILE_B = "55555555-5555-4555-8555-555555555555";
const COMPANY_ID = "company-a";

function unusedDownloadUrl(): never {
  throw new TypeError("getDownloadUrl should not run");
}

function stubDownloadUrlsClient(
  onGetDownloadUrls: FileDownloadClient["client"]["files"]["getDownloadUrls"],
): FileDownloadClient {
  return {
    client: {
      files: {
        getDownloadUrl: unusedDownloadUrl,
        getDownloadUrls: onGetDownloadUrls,
      },
    },
  };
}

describe("imageFileIdsFromGetProduct", () => {
  it("is undefined until getProduct data exists, then forwards the snapshot (including empty)", () => {
    expect(imageFileIdsFromGetProduct(undefined)).toBeUndefined();
    expect(imageFileIdsFromGetProduct({ imageFileIds: [] })).toEqual([]);
    expect(
      imageFileIdsFromGetProduct({ imageFileIds: [FILE_A, FILE_B] }),
    ).toEqual([FILE_A, FILE_B]);
  });
});

describe("photoManagerInputFromDetailQuery", () => {
  it("passes getProduct imageFileIds into the photo manager", () => {
    const imageFileIds = imageFileIdsFromGetProduct({
      imageFileIds: [FILE_A, FILE_B],
    });
    expect(
      photoManagerInputFromDetailQuery({
        productId: PRODUCT_ID,
        imageFileIds,
        canWrite: true,
      }),
    ).toEqual({
      productId: PRODUCT_ID,
      imageFileIds: [FILE_A, FILE_B],
      requireProduct: true,
      canWrite: true,
    });
  });

  it("keeps imageFileIds undefined while the query is pending so photos wait instead of calling getProduct", () => {
    const input = photoManagerInputFromDetailQuery({
      productId: PRODUCT_ID,
      imageFileIds: imageFileIdsFromGetProduct(undefined),
      canWrite: true,
    });
    expect(input.imageFileIds).toBeUndefined();
    expect(input.requireProduct).toBe(true);
  });

  it("forwards an empty snapshot after getProduct returns no media", () => {
    expect(
      photoManagerInputFromDetailQuery({
        productId: PRODUCT_ID,
        imageFileIds: imageFileIdsFromGetProduct({ imageFileIds: [] }),
        canWrite: false,
      }).imageFileIds,
    ).toEqual([]);
  });
});

describe("productDetailViewerDownloadQueryOptions", () => {
  const seededRoles = ["owner", "admin", "manager", "employee"] as const;

  it("stays disabled for every seeded role because canEdit and files:view are identical", () => {
    for (const role of seededRoles) {
      const canEdit = canEditProducts(role);
      const canFetchImages = canFetchFileDownloadUrls(role);
      expect(canEdit).toBe(canFetchImages);
      const options = productDetailViewerDownloadQueryOptions({
        client: stubDownloadUrlsClient(() => {
          throw new TypeError("getDownloadUrls should not run");
        }),
        companyId: COMPANY_ID,
        getActiveCompany: () => COMPANY_ID,
        imageFileIds: [FILE_A, FILE_B],
        canEdit,
        canFetchImages,
      });
      expect(options.enabled).toBe(false);
    }
  });

  it("requests card (160px strip) when a read-only viewer can fetch files (SHO-244 amendment)", async () => {
    expect(PRODUCT_PHOTOS_STRIP_RENDITION).toBe("card");
    expect(PRODUCT_PHOTOS_STRIP_RENDITION).not.toBe("hero");
    expect(PRODUCT_PHOTOS_STRIP_RENDITION).not.toBe("full");

    const seen: unknown[] = [];
    const client = stubDownloadUrlsClient((input) => {
      seen.push(input);
      return Promise.resolve({ files: [] });
    });
    const options = productDetailViewerDownloadQueryOptions({
      client,
      companyId: COMPANY_ID,
      getActiveCompany: () => COMPANY_ID,
      imageFileIds: [FILE_A, FILE_B],
      canEdit: false,
      canFetchImages: true,
    });
    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(
      contractQueryKey(GET_DOWNLOAD_URLS_ACTION, COMPANY_ID, {
        fileIds: [FILE_A, FILE_B],
        rendition: "card",
      }),
    );

    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    await queryClient.fetchQuery({ ...options, retry: false });
    expect(seen).toEqual([{ fileIds: [FILE_A, FILE_B], rendition: "card" }]);
    queryClient.clear();
  });
});

describe("detailViewerPhotoTiles", () => {
  it("builds committed tiles from the query file ids", () => {
    const tiles = detailViewerPhotoTiles([FILE_A]);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]?.fileId).toBe(FILE_A);
    expect(tiles[0]?.phase).toBe("ready");
  });
});
