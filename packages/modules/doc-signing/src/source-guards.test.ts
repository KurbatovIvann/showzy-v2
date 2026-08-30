import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

function readSrc(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

function executableSource(relative: string): string {
  return readSrc(relative)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

describe("doc-signing source guards (SHO-254 / SHO-257)", () => {
  it("does not import foreign documents or files schema (ADR-0014)", () => {
    const sources = [
      "actions/get.ts",
      "actions/get-supplier-signed-flags.ts",
      "actions/abandon-request.ts",
      "actions/start.ts",
      "events/request-abandoner.ts",
      "index.ts",
    ];
    for (const relative of sources) {
      const source = executableSource(relative);
      expect(source, relative).not.toContain("@showzy/db/schema/documents");
      expect(source, relative).not.toContain("@showzy/db/schema/files");
    }
    expect(executableSource("actions/get.ts")).toContain(
      "@showzy/db/schema/doc-signing",
    );
    expect(executableSource("actions/get.ts")).not.toContain("ctx.call");
    expect(executableSource("actions/get.ts")).not.toContain(
      "@showzy/documents",
    );
    expect(executableSource("actions/get-supplier-signed-flags.ts")).toContain(
      "@showzy/db/schema/doc-signing",
    );
    expect(executableSource("actions/abandon-request.ts")).toContain(
      "@showzy/db/schema/doc-signing",
    );
    expect(executableSource("actions/start.ts")).toContain(
      "@showzy/db/schema/doc-signing",
    );
    expect(executableSource("actions/start.ts")).toContain("ctx.call");
    expect(executableSource("actions/start.ts")).not.toContain("getArtifact");
    expect(executableSource("actions/start.ts")).not.toContain(
      "docSigning.complete",
    );
  });

  it("loads supplier flags with one inArray query, not a per-id loop", () => {
    const source = executableSource("actions/get-supplier-signed-flags.ts");
    expect(source).toContain("inArray(");
    expect(source.match(/inArray\(/g)?.length).toBe(1);
    expect(source).toContain(".from(signingSignatures)");
    expect(source.match(/\.from\(signingSignatures\)/g)?.length).toBe(1);
    expect(source.match(/ctx\.db/g)?.length).toBe(1);
    expect(source).not.toContain("ctx.call");
  });

  it("imports documentsCancelled from the documents barrel, not a service", () => {
    const source = executableSource("events/request-abandoner.ts");
    expect(source).toContain('from "@showzy/documents"');
    expect(source).toContain("documentsCancelled");
  });
});
