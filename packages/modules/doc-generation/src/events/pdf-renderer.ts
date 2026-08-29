import { defineEventHandler } from "@showzy/core";
import { documentsCreated } from "@showzy/documents";

import { renderPdf } from "../actions/render-pdf.js";

/** Consumer id: camelCase module + kebab name (core CONSUMER_NAME_PATTERN). */
export const PDF_RENDERER_CONSUMER = "docGeneration.pdf-renderer";

export const pdfRendererCreated = defineEventHandler({
  event: documentsCreated,
  consumer: PDF_RENDERER_CONSUMER,
  action: renderPdf,
});

/** Same objects the API composition root and the worker must both register. */
export const pdfRendererSubscriptions = [pdfRendererCreated] as const;
