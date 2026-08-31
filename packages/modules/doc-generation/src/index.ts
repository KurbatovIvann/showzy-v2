/**
 * Actions only. The `documents.created` subscriber lives at
 * `./subscriptions` so `documents.get` can import this barrel without
 * evaluating `defineEventHandler` while `renderPdf` is still initializing
 * (ESM cycle: getArtifact ← documents.get ← getForGeneration ← renderPdf).
 */
import { getArtifact } from "./actions/get-artifact.js";
import { renderPdf } from "./actions/render-pdf.js";

export { getArtifact };
export { renderPdf };

export const docGenerationActions = [getArtifact, renderPdf] as const;
