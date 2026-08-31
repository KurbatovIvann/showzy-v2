/**
 * Type-level proof that SHO-303 split modules keep the former
 * `product-photos-model.ts` public surface (signatures unchanged).
 * Runtime behavior stays in `product-photos-model.test.ts`.
 */
import { describe, expect, it } from "vitest";

import type { QueryFailureKind } from "../../../../api/errors";
import type { FileDownloadClient } from "../../../../api/file-download-query";
import { fileDownloadUrlsQueryOptions } from "../../../../api/file-download-query";
import type { ProductsPhotosCopy } from "../../../../i18n/products";
import {
  classifyProductPhotosLoad,
  type ProductPhotosLoadState,
} from "../shared/classify-product-load";
import {
  mapDeniedBanner,
  mapPhotoFailure,
  mapUploadBanner,
  resolvePhotoBanner,
  resolveProductPhotosBannerKey,
  type PhotoBannerKey,
} from "./product-photos-banners";
import {
  photoFlushOutcome,
  planPhotoCommit,
  type PhotoCommitPlan,
  type PhotoFlushOutcome,
} from "./product-photos-plan";
import {
  catalogImagePreparePlan,
  catalogImageStrategy,
  nextPhotoCompressPlan,
  type CatalogImagePreparePlan,
  type CatalogImageStrategy,
  type PhotoCompressPlan,
} from "./product-photos-prepare";
import {
  PRODUCT_PHOTOS_STRIP_RENDITION,
  productPhotosStripDownloadInput,
  productPhotosStripQueryOptions,
} from "./product-photos-queries";
import {
  addUploadSlots,
  applyCommitSuccess,
  canAddPhoto,
  committedSlotsFromFileIds,
  fileIdsEqual,
  hasInFlightPhotoUploads,
  hasUnreadyPhotoUploads,
  idleUploadSlots,
  movePhotoSlot,
  patchUploadMachine,
  photosAreDirty,
  readyOrderedFileIds,
  remainingPhotoSlots,
  removePhotoSlot,
  slotsTowardCap,
  toPhotoTiles,
  type PhotoSlot,
  type PhotoTilePhase,
  type PhotoTileView,
} from "./product-photos-slots";
import type { UploadFailureKind, UploadMachine } from "./product-photos-upload";

type OriginalPhotoSlot =
  | {
      readonly kind: "committed";
      readonly id: string;
      readonly fileId: string;
      readonly localUri: string | null;
    }
  | {
      readonly kind: "upload";
      readonly id: string;
      readonly localUri: string;
      readonly machine: UploadMachine;
    };

type OriginalPhotoTileView = {
  readonly id: string;
  readonly fileId: string | null;
  readonly localUri: string | null;
  readonly phase: "ready" | "uploading" | "failed";
  readonly progress: number;
  readonly isCover: boolean;
  readonly canMoveEarlier: boolean;
  readonly canMoveLater: boolean;
  readonly canRetry: boolean;
  readonly canCancel: boolean;
};

type OriginalLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

type OriginalBannerKey =
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "denied"
  | "validation"
  | "too_many"
  | "commit";

type OriginalCommitPlan =
  | { readonly kind: "noop" }
  | { readonly kind: "retry" }
  | {
      readonly kind: "write";
      readonly productId: string;
      readonly fileIds: readonly string[];
    };

function bothWays<A, B>(forward: (value: A) => B, back: (value: B) => A): void {
  expect(typeof forward).toBe("function");
  expect(typeof back).toBe("function");
}

describe("product-photos split public surface (SHO-303)", () => {
  it("keeps the former model types mutually assignable", () => {
    bothWays(
      (slot: PhotoSlot): OriginalPhotoSlot => slot,
      (slot: OriginalPhotoSlot): PhotoSlot => slot,
    );
    bothWays(
      (phase: PhotoTilePhase): OriginalPhotoTileView["phase"] => phase,
      (phase: OriginalPhotoTileView["phase"]): PhotoTilePhase => phase,
    );
    bothWays(
      (tile: PhotoTileView): OriginalPhotoTileView => tile,
      (tile: OriginalPhotoTileView): PhotoTileView => tile,
    );
    bothWays(
      (state: ProductPhotosLoadState): OriginalLoadState => state,
      (state: OriginalLoadState): ProductPhotosLoadState => state,
    );
    bothWays(
      (key: PhotoBannerKey): OriginalBannerKey => key,
      (key: OriginalBannerKey): PhotoBannerKey => key,
    );
    bothWays(
      (plan: PhotoCommitPlan): OriginalCommitPlan => plan,
      (plan: OriginalCommitPlan): PhotoCommitPlan => plan,
    );
    bothWays(
      (outcome: PhotoFlushOutcome): "ok" | "commit-failed" | "upload-failed" =>
        outcome,
      (outcome: "ok" | "commit-failed" | "upload-failed"): PhotoFlushOutcome =>
        outcome,
    );
    bothWays(
      (
        strategy: CatalogImageStrategy,
      ): "keep-jpeg" | "keep-png" | "keep-webp" | "convert-jpeg" => strategy,
      (
        strategy: "keep-jpeg" | "keep-png" | "keep-webp" | "convert-jpeg",
      ): CatalogImageStrategy => strategy,
    );
    bothWays(
      (
        plan: CatalogImagePreparePlan,
      ): { readonly kind: "keep" } | { readonly kind: "compress" } => plan,
      (
        plan: { readonly kind: "keep" } | { readonly kind: "compress" },
      ): CatalogImagePreparePlan => plan,
    );
    bothWays(
      (
        plan: PhotoCompressPlan,
      ):
        | { readonly kind: "ok" }
        | {
            readonly kind: "again";
            readonly edge: number;
            readonly compress: number;
          }
        | { readonly kind: "fail" } => plan,
      (
        plan:
          | { readonly kind: "ok" }
          | {
              readonly kind: "again";
              readonly edge: number;
              readonly compress: number;
            }
          | { readonly kind: "fail" },
      ): PhotoCompressPlan => plan,
    );
  });

  it("keeps the former model function signatures", () => {
    const hasInFlight: (slots: readonly PhotoSlot[]) => boolean =
      hasInFlightPhotoUploads;
    const hasUnready: (slots: readonly PhotoSlot[]) => boolean =
      hasUnreadyPhotoUploads;
    const dirty: (
      slots: readonly PhotoSlot[],
      lastCommitted: readonly string[] | null,
    ) => boolean = photosAreDirty;
    const fromIds: (fileIds: readonly string[]) => readonly PhotoSlot[] =
      committedSlotsFromFileIds;
    const towardCap: (slots: readonly PhotoSlot[]) => number = slotsTowardCap;
    const canAdd: (slots: readonly PhotoSlot[]) => boolean = canAddPhoto;
    const add: (
      slots: readonly PhotoSlot[],
      photos: readonly { readonly id: string; readonly localUri: string }[],
    ) => { readonly slots: readonly PhotoSlot[]; readonly added: number } =
      addUploadSlots;
    const remove: (
      slots: readonly PhotoSlot[],
      id: string,
    ) => readonly PhotoSlot[] = removePhotoSlot;
    const move: (
      slots: readonly PhotoSlot[],
      id: string,
      direction: "earlier" | "later",
    ) => readonly PhotoSlot[] = movePhotoSlot;
    const patch: (
      slots: readonly PhotoSlot[],
      id: string,
      machine: UploadMachine,
    ) => readonly PhotoSlot[] = patchUploadMachine;
    const readyIds: (slots: readonly PhotoSlot[]) => string[] =
      readyOrderedFileIds;
    const idle: (slots: readonly PhotoSlot[]) => readonly PhotoSlot[] =
      idleUploadSlots;
    const apply: (
      slots: readonly PhotoSlot[],
      fileIds: readonly string[],
    ) => readonly PhotoSlot[] = applyCommitSuccess;
    const equal: (
      left: readonly string[],
      right: readonly string[],
    ) => boolean = fileIdsEqual;
    const tiles: (slots: readonly PhotoSlot[]) => readonly PhotoTileView[] =
      toPhotoTiles;
    const remaining: (slots: readonly PhotoSlot[]) => number =
      remainingPhotoSlots;
    const plan: (args: {
      readonly productId: string | null;
      readonly slots: readonly PhotoSlot[];
      readonly lastCommitted: readonly string[] | null;
      readonly lastWrite: readonly string[] | null;
      readonly lastFailureKind: QueryFailureKind | null;
      readonly canRetryAttempt: boolean;
    }) => PhotoCommitPlan = planPhotoCommit;
    const flush: (args: {
      readonly planKind: PhotoCommitPlan["kind"];
      readonly lastFailureKind: QueryFailureKind | null;
      readonly slots: readonly PhotoSlot[];
    }) => PhotoFlushOutcome = photoFlushOutcome;
    const denied: (
      source: "camera" | "library" | null,
    ) => PhotoBannerKey | null = mapDeniedBanner;
    const photoFail: (kind: QueryFailureKind | null) => PhotoBannerKey | null =
      mapPhotoFailure;
    const uploadBanner: (
      reason: UploadFailureKind | null,
    ) => PhotoBannerKey | null = mapUploadBanner;
    const resolveBanner: (
      copy: ProductsPhotosCopy,
      key: PhotoBannerKey | null,
    ) => string | null = resolvePhotoBanner;
    const bannerKey: (args: {
      readonly localBanner: PhotoBannerKey | null;
      readonly mutationFailure: QueryFailureKind | null;
      readonly downloadFailure: QueryFailureKind | null;
    }) => PhotoBannerKey | null = resolveProductPhotosBannerKey;
    const classify: (args: {
      readonly canWrite: boolean;
      readonly productId: string | null;
      readonly requireProduct: boolean;
      readonly clientReady: boolean;
      readonly status: "pending" | "error" | "success";
      readonly failureKind: QueryFailureKind | null;
    }) => ProductPhotosLoadState = classifyProductPhotosLoad;
    const strategy: (
      mimeType: string | undefined,
      fileName: string | undefined,
    ) => CatalogImageStrategy = catalogImageStrategy;
    const prepare: (args: {
      readonly strategy: CatalogImageStrategy;
      readonly byteSize: number;
      readonly longEdge: number;
    }) => CatalogImagePreparePlan = catalogImagePreparePlan;
    const compress: (args: {
      readonly byteSize: number;
      readonly edge: number;
      readonly compress: number;
    }) => PhotoCompressPlan = nextPhotoCompressPlan;
    const stripInput: (fileIds: readonly string[]) => {
      readonly fileIds: string[];
      readonly rendition: "card";
    } = productPhotosStripDownloadInput;
    const stripQuery: (args: {
      readonly client: FileDownloadClient | null;
      readonly companyId: string | null;
      readonly getActiveCompany: () => string | null;
      readonly fileIds: readonly string[];
      readonly canWrite: boolean;
      readonly canFetchImages: boolean;
    }) => ReturnType<typeof fileDownloadUrlsQueryOptions> =
      productPhotosStripQueryOptions;
    const rendition: "card" = PRODUCT_PHOTOS_STRIP_RENDITION;

    expect(hasInFlight).toBe(hasInFlightPhotoUploads);
    expect(hasUnready).toBe(hasUnreadyPhotoUploads);
    expect(dirty).toBe(photosAreDirty);
    expect(fromIds).toBe(committedSlotsFromFileIds);
    expect(towardCap).toBe(slotsTowardCap);
    expect(canAdd).toBe(canAddPhoto);
    expect(add).toBe(addUploadSlots);
    expect(remove).toBe(removePhotoSlot);
    expect(move).toBe(movePhotoSlot);
    expect(patch).toBe(patchUploadMachine);
    expect(readyIds).toBe(readyOrderedFileIds);
    expect(idle).toBe(idleUploadSlots);
    expect(apply).toBe(applyCommitSuccess);
    expect(equal).toBe(fileIdsEqual);
    expect(tiles).toBe(toPhotoTiles);
    expect(remaining).toBe(remainingPhotoSlots);
    expect(plan).toBe(planPhotoCommit);
    expect(flush).toBe(photoFlushOutcome);
    expect(denied).toBe(mapDeniedBanner);
    expect(photoFail).toBe(mapPhotoFailure);
    expect(uploadBanner).toBe(mapUploadBanner);
    expect(resolveBanner).toBe(resolvePhotoBanner);
    expect(bannerKey).toBe(resolveProductPhotosBannerKey);
    expect(classify).toBe(classifyProductPhotosLoad);
    expect(strategy).toBe(catalogImageStrategy);
    expect(prepare).toBe(catalogImagePreparePlan);
    expect(compress).toBe(nextPhotoCompressPlan);
    expect(stripInput).toBe(productPhotosStripDownloadInput);
    expect(stripQuery).toBe(productPhotosStripQueryOptions);
    expect(rendition).toBe("card");
  });
});
