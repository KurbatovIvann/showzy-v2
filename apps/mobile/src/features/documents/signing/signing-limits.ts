/**
 * ASiC-E handshake ceilings (SHO-260 / SHO-251). Same 25 MiB class as
 * files `MAX_DOCUMENT_BYTES`. Payload ZIP name matches complete verify
 * (`document.pdf`). Do not put ASiC bytes on an oRPC body.
 */
export const SIGNING_PURPOSE = "signing" as const;

export const SIGNING_MIME_TYPE = "application/vnd.etsi.asic-e+zip" as const;

export const SIGNING_PAYLOAD_NAME = "document.pdf" as const;

export const MAX_SIGNING_BYTES = 25 * 1024 * 1024;

export const ASIC_MANIFEST_NAME = "META-INF/ASiCManifest001.xml" as const;

export const ASIC_SIGNATURE_NAME = "META-INF/signature001.p7s" as const;
