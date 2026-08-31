/**
 * The single source of event-subscription composition (SHO-279). Module
 * tasks register their `defineEventHandler` objects **here**; the
 * contract-check input (`src/composition.ts`) and the worker delivery
 * loop (`apps/worker/src/subscriptions.ts`) both derive from this list,
 * so a subscription registered for CI but forgotten by the worker is
 * structurally impossible.
 */
import { orderCardUpdaterSubscriptions } from "@showzy/chat";
import type { EventSubscription } from "@showzy/core";
import { pdfRendererSubscriptions } from "@showzy/doc-generation/subscriptions";
import { requestAbandonerSubscriptions } from "@showzy/doc-signing/subscriptions";
import { signedShareAttacherSubscriptions } from "@showzy/documents/subscriptions";

export const registeredEventSubscriptions: readonly EventSubscription[] = [
  ...orderCardUpdaterSubscriptions,
  ...pdfRendererSubscriptions,
  ...requestAbandonerSubscriptions,
  ...signedShareAttacherSubscriptions,
];
