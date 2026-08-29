/**
 * Actions only. The `documents.created` subscriber lives at
 * `./subscriptions` so `documents.get` can import this barrel without
 * evaluating `defineEventHandler` while `renderPdf` is still initializing
 * (ESM cycle: getArtifact ← documents.get ← getForGeneration ← renderPdf).
 */
export { getArtifact } from "./actions/get-artifact.js";
export { renderPdf } from "./actions/render-pdf.js";
