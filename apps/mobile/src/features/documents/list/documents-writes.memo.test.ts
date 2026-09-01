import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("documents writes-hook referential stability", () => {
  it("stabilizes list write callbacks so row memo can bail", () => {
    const writes = readFileSync(
      new URL("./use-document-writes.ts", import.meta.url),
      "utf8",
    );
    const options = readFileSync(
      new URL("./use-document-list-options.ts", import.meta.url),
      "utf8",
    );
    const list = readFileSync(
      new URL("./use-documents-list.ts", import.meta.url),
      "utf8",
    );
    const row = readFileSync(
      new URL("./document-row.tsx", import.meta.url),
      "utf8",
    );
    expect(writes).toContain("const mintShareUrl = useCallback(");
    expect(writes).toContain("const cancel = useCallback(");
    expect(writes).toContain("return useMemo(");
    expect(writes).toContain("argsRef.current");
    expect(writes).toContain("shareMintFailureBanner");
    expect(writes).not.toMatch(/catch \{\s*return null;/);
    expect(options).toContain("const openOptions = useCallback(");
    expect(options).toContain("return useMemo(");
    expect(list).toContain("const signRow = useCallback(");
    expect(list).toContain("requestSignRef.current");
    expect(list).toContain("signingVisibleRef.current");
    expect(list).not.toContain("[rows, signing]");
    expect(row).toContain("memo(function DocumentRow");
    expect(row).toContain("onSign: (id: string) => void");
    expect(row).toContain("onOptions: (id: string) => void");
    expect(writes).not.toContain("console.log");
    expect(writes).not.toContain("console.warn");
    expect(writes).toContain("never logs it");
  });
});
