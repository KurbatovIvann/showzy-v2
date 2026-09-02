import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Inflate PDF streams and map CID hex through each ToUnicode CMap so tests
 * can assert distinctive layout strings without a PDF library.
 */
function inflateMaybe(data: Buffer): string {
  try {
    return inflateSync(data).toString("latin1");
  } catch {
    try {
      return inflateRawSync(data).toString("latin1");
    } catch {
      return data.toString("latin1");
    }
  }
}

function pdfStreams(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match = re.exec(raw);
  while (match !== null) {
    const payload = match[1];
    if (payload !== undefined) {
      streams.push(inflateMaybe(Buffer.from(payload, "latin1")));
    }
    match = re.exec(raw);
  }
  return streams;
}

function utf16BeFromHex(hex: string): string {
  if (hex.length === 0 || hex.length % 4 !== 0) {
    return "";
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.byteLength !== hex.length / 2) {
    return "";
  }
  let out = "";
  for (let i = 0; i + 1 < buf.byteLength; i += 2) {
    out += String.fromCharCode(buf.readUInt16BE(i));
  }
  return out;
}

function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const bfcharBlocks = cmap.split("beginbfchar").slice(1);
  for (const block of bfcharBlocks) {
    const body = block.split("endbfchar")[0] ?? "";
    const pairs = body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g);
    for (const pair of pairs) {
      const src = pair[1];
      const dst = pair[2];
      if (src === undefined || dst === undefined) {
        continue;
      }
      map.set(Number.parseInt(src, 16), utf16BeFromHex(dst));
    }
  }
  const bfrangeBlocks = cmap.split("beginbfrange").slice(1);
  for (const block of bfrangeBlocks) {
    const body = block.split("endbfrange")[0] ?? "";
    const arrayRanges = body.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g,
    );
    for (const range of arrayRanges) {
      const startHex = range[1];
      const destsBody = range[3];
      if (startHex === undefined || destsBody === undefined) {
        continue;
      }
      const start = Number.parseInt(startHex, 16);
      const dests = [...destsBody.matchAll(/<([0-9A-Fa-f]*)>/g)];
      dests.forEach((dest, index) => {
        const destHex = dest[1];
        if (destHex !== undefined) {
          map.set(start + index, utf16BeFromHex(destHex));
        }
      });
    }
    const withoutArrays = body.replace(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[[^\]]+\]/g,
      "",
    );
    const sequential = withoutArrays.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    );
    for (const range of sequential) {
      const startHex = range[1];
      const endHex = range[2];
      const destHex = range[3];
      if (
        startHex === undefined ||
        endHex === undefined ||
        destHex === undefined
      ) {
        continue;
      }
      const start = Number.parseInt(startHex, 16);
      const end = Number.parseInt(endHex, 16);
      const destStart = Number.parseInt(destHex, 16);
      for (let gid = start; gid <= end; gid++) {
        map.set(gid, String.fromCharCode(destStart + (gid - start)));
      }
    }
  }
  return map;
}

function applyMapToHex(hex: string, cmap: Map<number, string>): string {
  const width = hex.length % 4 === 0 ? 4 : 2;
  let out = "";
  for (let i = 0; i + width <= hex.length; i += width) {
    const gid = Number.parseInt(hex.slice(i, i + width), 16);
    out += cmap.get(gid) ?? "";
  }
  return out;
}

function unescapePdfLiteral(inner: string): string {
  return inner
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\\\", "\\")
    .replace(/\\(\d{1,3})/g, (_match, oct: string) =>
      String.fromCharCode(Number.parseInt(oct, 8)),
    );
}

type ShowOp =
  | { readonly kind: "hex"; readonly hex: string }
  | { readonly kind: "lit"; readonly text: string };

function collectShowOps(content: string): ShowOp[] {
  const ops: ShowOp[] = [];
  const token =
    /<([0-9A-Fa-f]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match = token.exec(content);
  while (match !== null) {
    const hexTj = match[1];
    const tjArray = match[2];
    if (hexTj !== undefined) {
      ops.push({ kind: "hex", hex: hexTj });
    } else if (tjArray !== undefined) {
      const inner = tjArray.matchAll(/<([0-9A-Fa-f]+)>|\((?:\\.|[^\\)])*\)/g);
      for (const piece of inner) {
        const innerHex = piece[1];
        if (innerHex !== undefined) {
          ops.push({ kind: "hex", hex: innerHex });
        } else {
          ops.push({
            kind: "lit",
            text: unescapePdfLiteral(piece[0].slice(1, -1)),
          });
        }
      }
    } else {
      const tokenText = match[0].replace(/\s*Tj$/, "");
      ops.push({
        kind: "lit",
        text: unescapePdfLiteral(tokenText.slice(1, -1)),
      });
    }
    match = token.exec(content);
  }
  return ops;
}

function applyOps(ops: readonly ShowOp[], cmap: Map<number, string>): string {
  let out = "";
  for (const op of ops) {
    if (op.kind === "hex") {
      out += applyMapToHex(op.hex, cmap);
    } else {
      out += op.text;
    }
  }
  return out;
}

export function extractPdfText(bytes: Uint8Array): string {
  const streams = pdfStreams(bytes);
  const content = streams
    .filter(
      (stream) =>
        (stream.includes("Tj") || stream.includes(" TJ")) &&
        !stream.includes("beginbfchar") &&
        !stream.includes("beginbfrange"),
    )
    .join("\n");
  const cmaps = streams
    .filter(
      (stream) =>
        stream.includes("beginbfchar") || stream.includes("beginbfrange"),
    )
    .map(parseToUnicode);
  const ops = collectShowOps(content);
  const runs = cmaps.map((cmap) => applyOps(ops, cmap));
  const literals = ops
    .filter((op) => op.kind === "lit")
    .map((op) => op.text)
    .join("");
  return [...runs, literals].join("\n");
}
