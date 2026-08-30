import { describe, expect, it } from "vitest";

import { renderPdf } from "../actions/render-pdf.js";
import {
  PDF_RENDERER_CONSUMER,
  pdfRendererCreated,
  pdfRendererSubscriptions,
} from "./pdf-renderer.js";

describe("docGeneration.pdf-renderer", () => {
  it("binds documents.created to renderPdf under one consumer id", () => {
    expect(PDF_RENDERER_CONSUMER).toBe("docGeneration.pdf-renderer");
    expect(pdfRendererCreated.consumer).toBe(PDF_RENDERER_CONSUMER);
    expect(pdfRendererCreated.event.name).toBe("documents.created");
    expect(pdfRendererCreated.contract).toBe(renderPdf.contract);
    expect(pdfRendererSubscriptions).toEqual([pdfRendererCreated]);
  });
});
