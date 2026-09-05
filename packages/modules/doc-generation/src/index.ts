/**
 * Actions only. The `documents.created` subscriber lives at
 * `./subscriptions` so `documents.get` can import this barrel without
 * evaluating `defineEventHandler` while `renderPdf` is still initializing
 * (ESM cycle: getArtifact ← documents.get ← getForGeneration ← renderPdf).
 */
import { getArtifact } from "./actions/get-artifact.js";
import { listLayouts } from "./actions/list-layouts.js";
import { markFailed } from "./actions/mark-failed.js";
import { renderPdf } from "./actions/render-pdf.js";
import { resolveLayout } from "./actions/resolve-layout.js";

export { getArtifact };
export { listLayouts };
export { markFailed };
export { renderPdf };
export { resolveLayout };

export const docGenerationActions = [
  getArtifact,
  listLayouts,
  markFailed,
  renderPdf,
  resolveLayout,
] as const;
