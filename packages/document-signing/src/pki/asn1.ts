interface TlvResult {
  content: Uint8Array;
  rest: Uint8Array;
}

export function parseTlv(input: Uint8Array): TlvResult | null {
  if (input.length < 2) return null;
  const first = input[1];
  if (first === undefined) return null;
  let headerSize: number;
  let len: number;

  if (first < 0x80) {
    len = first;
    headerSize = 2;
  } else {
    const numBytes = first & 0x7f;
    if (numBytes === 0 || numBytes > 4 || input.length < 2 + numBytes)
      return null;
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | (input[2 + i] ?? 0);
    }
    headerSize = 2 + numBytes;
  }

  if (input.length < headerSize + len) return null;

  return {
    content: input.subarray(headerSize, headerSize + len),
    rest: input.subarray(headerSize + len),
  };
}

function encodeAsn1Length(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  if (len < 0x100) return new Uint8Array([0x81, len]);
  if (len < 0x10000)
    return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
  return new Uint8Array([
    0x83,
    (len >> 16) & 0xff,
    (len >> 8) & 0xff,
    len & 0xff,
  ]);
}

export function asn1Wrap(tag: number, content: Uint8Array): Uint8Array {
  const lenBytes = encodeAsn1Length(content.length);
  const result = new Uint8Array(1 + lenBytes.length + content.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(content, 1 + lenBytes.length);
  return result;
}

export function wrapInContentInfo(payload: Uint8Array): Uint8Array {
  const oid = new Uint8Array([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01,
  ]);
  const octetString = asn1Wrap(0x04, payload);
  const explicitCtx0 = asn1Wrap(0xa0, octetString);

  const seqContent = new Uint8Array(oid.length + explicitCtx0.length);
  seqContent.set(oid, 0);
  seqContent.set(explicitCtx0, oid.length);

  return asn1Wrap(0x30, seqContent);
}

export function unwrapContentInfo(data: Uint8Array): Uint8Array | null {
  const seq = parseTlv(data);
  if (!seq) return null;
  const afterOid = parseTlv(seq.content);
  if (!afterOid) return null;
  const ctx0 = parseTlv(afterOid.rest);
  if (!ctx0) return null;
  const octet = parseTlv(ctx0.content);
  if (!octet) return null;
  return octet.content;
}

/**
 * Extract X.509 certificates from a PKCS#7 SignedData structure.
 */
export function extractCertsFromPkcs7(data: Uint8Array): Uint8Array[] {
  const certs: Uint8Array[] = [];

  const ciContent = parseTlv(data);
  if (!ciContent) return certs;

  const afterOid = parseTlv(ciContent.content);
  if (!afterOid) return certs;

  if (afterOid.rest.length === 0 || afterOid.rest[0] !== 0xa0) return certs;
  const sdWrapper = parseTlv(afterOid.rest);
  if (!sdWrapper) return certs;

  const sdSeq = parseTlv(sdWrapper.content);
  const sdInner: Uint8Array = sdSeq ? sdSeq.content : sdWrapper.content;

  let pos = parseTlv(sdInner);
  if (!pos) return certs;
  pos = parseTlv(pos.rest);
  if (!pos) return certs;
  pos = parseTlv(pos.rest);
  if (!pos) return certs;

  let remaining = pos.rest;
  while (remaining.length > 0) {
    const tag = remaining[0];
    if (tag === undefined) break;

    if (tag === 0xa0) {
      const certsContainer = parseTlv(remaining);
      if (!certsContainer) break;

      let certPos = certsContainer.content;
      while (certPos.length > 0) {
        if (certPos[0] !== 0x30) break;
        const certTlv = parseTlv(certPos);
        if (!certTlv) break;
        const certLen = certPos.length - certTlv.rest.length;
        if (certLen > 100) {
          certs.push(certPos.slice(0, certLen));
        }
        certPos = certTlv.rest;
      }
      break;
    }

    const skip = parseTlv(remaining);
    if (!skip) break;
    remaining = skip.rest;
  }

  return certs;
}
