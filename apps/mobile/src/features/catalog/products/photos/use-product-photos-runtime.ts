/**
 * Photo runtime + commit-loop construction (SHO-303). Session Query
 * wiring stays in `use-product-photos-query.ts`; the composer owns
 * hydrate / bind / retry effects.
 */
import { useEffect, useRef, type RefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";

import type { ContractClient } from "../../../../api/client";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import {
  flushPhotoSession,
  runPhotoCommitLoop,
  type PhotoCommitPorts,
  type ProductPhotosFlushResult,
} from "./product-photos-commit";
import {
  pickProductPhotos,
  prepareCatalogImage,
  putCatalogBytes,
} from "./product-photos-native";
import {
  createProductPhotosRuntime,
  type ProductPhotosRuntime,
} from "./product-photos-runtime";
import type {
  PhotoSessionContext,
  PhotoSessionEvent,
} from "./product-photos-session";

export function useProductPhotosRuntime(args: {
  readonly sessionRef: RefObject<PhotoSessionContext>;
  readonly send: (event: PhotoSessionEvent) => void;
  readonly getClient: () => ContractClient | null;
  readonly mutation: Pick<PhotoCommitPorts, "submit" | "retry" | "reset">;
  readonly queryClient: QueryClient;
  readonly activeCompanyId: string | null;
}): {
  readonly runtime: ProductPhotosRuntime;
  readonly commitIfNeeded: () => Promise<void>;
  readonly flush: () => Promise<ProductPhotosFlushResult>;
} {
  const sendRef = useRef(args.send);
  sendRef.current = args.send;
  const runtimeRef = useRef<ProductPhotosRuntime | undefined>(undefined);
  const commitRef = useRef<() => Promise<void>>(() => Promise.resolve());
  if (runtimeRef.current === undefined) {
    runtimeRef.current = createProductPhotosRuntime({
      getContext: () => args.sessionRef.current,
      send: (event: PhotoSessionEvent) => {
        sendRef.current(event);
      },
      getClient: args.getClient,
      commitIfNeeded: () => commitRef.current(),
      pickPhotos: pickProductPhotos,
      prepareImage: prepareCatalogImage,
      putBytes: putCatalogBytes,
    });
  }
  const runtime = runtimeRef.current;
  commitRef.current = () =>
    runPhotoCommitLoop({
      getContext: () => args.sessionRef.current,
      send: (event: PhotoSessionEvent) => {
        sendRef.current(event);
      },
      submit: args.mutation.submit,
      retry: args.mutation.retry,
      reset: args.mutation.reset,
      invalidate: () =>
        invalidateCatalogAfterStatusWrite({
          queryClient: args.queryClient,
          companyId: args.activeCompanyId,
        }),
      onSettled: runtime.notifySettled,
    });

  useEffect(() => {
    runtime.setMounted(true);
    return () => {
      runtime.setMounted(false);
      runtime.abortAll();
    };
  }, [runtime]);

  return {
    runtime,
    commitIfNeeded: () => commitRef.current(),
    flush: () =>
      flushPhotoSession({
        kickIdle: runtime.kickIdleUploads,
        waitUntilSettled: runtime.waitUntilSettled,
        commitIfNeeded: () => commitRef.current(),
        getContext: () => args.sessionRef.current,
        send: (event: PhotoSessionEvent) => {
          sendRef.current(event);
        },
      }),
  };
}
