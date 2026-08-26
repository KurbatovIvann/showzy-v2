import { describe, expect, it } from "vitest";

import {
  detailViewerPhotoTiles,
  photoManagerInputFromDetailQuery,
} from "./product-detail-photos";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const FILE_A = "44444444-4444-4444-8444-444444444444";
const FILE_B = "55555555-5555-4555-8555-555555555555";

describe("photoManagerInputFromDetailQuery", () => {
  it("passes getProduct imageFileIds into the photo manager", () => {
    const imageFileIds = [FILE_A, FILE_B];
    expect(
      photoManagerInputFromDetailQuery({
        productId: PRODUCT_ID,
        imageFileIds,
        canWrite: true,
      }),
    ).toEqual({
      productId: PRODUCT_ID,
      imageFileIds,
      requireProduct: true,
      canWrite: true,
    });
  });

  it("keeps imageFileIds undefined while the query is pending so photos wait instead of calling getProduct", () => {
    const input = photoManagerInputFromDetailQuery({
      productId: PRODUCT_ID,
      imageFileIds: undefined,
      canWrite: true,
    });
    expect(input.imageFileIds).toBeUndefined();
    expect(input.requireProduct).toBe(true);
  });

  it("forwards an empty snapshot after getProduct returns no media", () => {
    expect(
      photoManagerInputFromDetailQuery({
        productId: PRODUCT_ID,
        imageFileIds: [],
        canWrite: false,
      }).imageFileIds,
    ).toEqual([]);
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
