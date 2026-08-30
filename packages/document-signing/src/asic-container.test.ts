import { describe, expect, it } from "vitest";

import { ASIC_E_MIMETYPE, packAsicE, unpackAsicE } from "./asic-container.js";
import { AsicContainerError } from "./errors.js";

const encoder = new TextEncoder();

describe("ASiC-E pack/unpack", () => {
  it("round-trips mimetype-first stored entries", () => {
    const payload = encoder.encode("%PDF-1.4\n%%EOF\n");
    const manifest = encoder.encode("<asic:ASiCManifest/>");
    const signature = encoder.encode("p7s-bytes");
    const packed = packAsicE([
      { name: "document.pdf", bytes: payload },
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      { name: "META-INF/ASiCManifest001.xml", bytes: manifest },
      { name: "META-INF/signature001.p7s", bytes: signature },
    ]);
    expect(packed[0]).toBe(0x50);
    expect(packed[1]).toBe(0x4b);
    const unpacked = unpackAsicE(packed);
    expect(unpacked.entries[0]?.name).toBe("mimetype");
    expect(
      new TextDecoder().decode(unpacked.entries[0]?.bytes ?? new Uint8Array()),
    ).toBe(ASIC_E_MIMETYPE);
    expect(unpacked.payload.name).toBe("document.pdf");
    expect(
      Buffer.from(unpacked.payload.bytes).equals(Buffer.from(payload)),
    ).toBe(true);
    expect(unpacked.manifest.name).toBe("META-INF/ASiCManifest001.xml");
    expect(unpacked.signature.name).toBe("META-INF/signature001.p7s");
  });

  it("rejects a ZIP that is not ASiC-E", () => {
    const packed = packAsicE([
      { name: "mimetype", bytes: encoder.encode(ASIC_E_MIMETYPE) },
      { name: "note.txt", bytes: encoder.encode("hi") },
    ]);
    expect(() => unpackAsicE(packed)).toThrow(AsicContainerError);
    expect(() => unpackAsicE(encoder.encode("not-a-zip"))).toThrow(
      AsicContainerError,
    );
  });
});
