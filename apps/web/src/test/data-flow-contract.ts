/**
 * SHO-330 data-flow guard helpers. SHO-421: normalize paths to POSIX once
 * at the collection boundary, then match. Do not sprinkle `path.sep` through
 * the predicates — `node:path` `join()` is backslashes on Windows.
 */

export function toPosix(filename: string): string {
  return filename.replaceAll("\\", "/");
}

export function isProductionSource(filePosix: string): boolean {
  if (!/\.(ts|tsx)$/.test(filePosix)) {
    return false;
  }
  if (/\.test\.(ts|tsx)$/.test(filePosix)) {
    return false;
  }
  if (filePosix.includes("/test/")) {
    return false;
  }
  if (filePosix.endsWith("/routeTree.gen.ts")) {
    return false;
  }
  return true;
}

export type ContractDataPathScan = {
  fetchFiles: string[];
  constructorFiles: string[];
  forbiddenClientImportFiles: string[];
};

/**
 * Path predicates assume POSIX. Callers must `toPosix` every file and
 * `webSrc` before scanning.
 */
export function scanContractDataPath(
  filesPosix: string[],
  webSrcPosix: string,
  readText: (filePosix: string) => string,
): ContractDataPathScan {
  const fetchFiles = filesPosix.filter((file) =>
    /\bfetch\s*\(/.test(readText(file)),
  );
  const constructorFiles = filesPosix.filter((file) => {
    const text = readText(file);
    return (
      /\bcreateShowzyClient\s*\(/.test(text) ||
      /\bcreateContractClient\s*\(/.test(text)
    );
  });
  const forbiddenClientImportFiles = filesPosix.filter((file) => {
    const rel = file.slice(webSrcPosix.length + 1);
    if (rel.startsWith("api/") || rel.startsWith("app/")) {
      return false;
    }
    if (rel.startsWith("features/") && /\/api\//.test(rel)) {
      return false;
    }
    return /from ["'][^"']*\/api\/client["']/.test(readText(file));
  });
  return { fetchFiles, constructorFiles, forbiddenClientImportFiles };
}
