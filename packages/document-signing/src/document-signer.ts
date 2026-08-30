import {
  InitializationError,
  InvalidPasswordError,
  NoKeysFoundError,
  SignFailedError,
  StorageError,
} from "./errors.js";
import type { AdapterInitOptions, UapkiAdapter } from "./platform/adapter.js";
import { resolveSignParams } from "./pki/algorithms.js";
import {
  type CaProvider,
  fetchCaCertBundle,
  fetchCaCerts,
  findCaByIssuerCn,
  getAllCmpUrls,
  loadCaRegistry,
} from "./pki/ca-registry.js";
import { fetchUserCerts } from "./pki/cert-fetch.js";
import { uint8ToBase64 } from "./pki/encoding.js";
import type {
  CertInfo,
  DocumentSignerOptions,
  KeyInfo,
  SignOptions,
  SignResult,
  UapkiResponse,
  ValidateKeyResult,
} from "./types.js";

const WRONG_PASSWORD_CODES = new Set([
  0x00020017,
  0x00020023,
  0x0002001a,
  0x040b, // RET_CM_INVALID_MAC
  0x0411, // RET_CM_INVALID_PASSWORD
  0x040c, // RET_CM_WITHOUT_MAC
  23, // RET_INVALID_MAC (UAPKIC)
]);

export class DocumentSigner {
  private adapter: UapkiAdapter;
  private options: DocumentSignerOptions;
  private identifiedCa: CaProvider | null = null;
  private initialized = false;

  private constructor(adapter: UapkiAdapter, options: DocumentSignerOptions) {
    this.adapter = adapter;
    this.options = options;
  }

  /**
   * Create and initialize a DocumentSigner with the given platform adapter.
   *
   * Usage (web):
   * ```ts
   * import { DocumentSigner } from '@showzy/document-signing';
   * import { createWebAdapter } from '@showzy/document-signing/web';
   *
   * const signer = await DocumentSigner.create(createWebAdapter(), {
   *   corsProxyUrl: '/pki/proxy',
   * });
   * ```
   *
   * Usage (React Native):
   * ```ts
   * import { DocumentSigner } from '@showzy/document-signing';
   * import { createNativeAdapter } from '@showzy/document-signing/native';
   *
   * const signer = await DocumentSigner.create(createNativeAdapter(), {
   *   corsProxyUrl: '/pki/proxy',
   * });
   * ```
   */
  static async create(
    adapter: UapkiAdapter,
    options: DocumentSignerOptions = {},
  ): Promise<DocumentSigner> {
    const signer = new DocumentSigner(adapter, options);
    await signer.init();
    return signer;
  }

  /**
   * Validate a key container and return certificate info for user confirmation.
   * No CMP/OCSP network calls are made here -- cert chain fetching is
   * deferred to signDocument() where it's actually needed.
   *
   * Falls back to a full CMP fan-out only for rare containers that don't
   * embed the signer certificate.
   */
  async validateKey(
    keyBytes: Uint8Array,
    password: string,
  ): Promise<ValidateKeyResult> {
    this.assertInitialized();

    await this.openStorage(keyBytes, password);

    try {
      const keys = await this.listKeys();
      const signingKey = findSigningKey(keys);
      if (!signingKey) throw new NoKeysFoundError();

      const selectResult = await this.callMethod("SELECT_KEY", {
        id: signingKey.id,
      });
      let certBase64 = selectResult.result?.certificate as string | undefined;

      if (certBase64) {
        const certInfo = await this.getCertInfo(certBase64);
        this.identifiedCa = findCaByIssuerCn(certInfo.issuer) ?? null;
        return { certInfo, keys };
      }

      // Rare fallback: container doesn't embed a cert -- fetch from all CAs
      await this.fetchAndAddUserCerts(keys);

      const retryResult = await this.callMethod("SELECT_KEY", {
        id: signingKey.id,
      });
      certBase64 = retryResult.result?.certificate as string | undefined;
      if (!certBase64) {
        throw new StorageError("SELECT_KEY did not return a certificate");
      }

      const certInfo = await this.getCertInfo(certBase64);
      this.identifiedCa = findCaByIssuerCn(certInfo.issuer) ?? null;

      return { certInfo, keys };
    } finally {
      await this.closeStorage();
    }
  }

  /**
   * Sign document data with the given key container.
   * Returns the PKCS#7 signature (base64), the signer certificate (DER base64),
   * and parsed certificate info.
   */
  async signDocument(
    keyBytes: Uint8Array,
    password: string,
    data: Uint8Array,
    options: SignOptions = {},
  ): Promise<SignResult> {
    this.assertInitialized();

    await this.openStorage(keyBytes, password);

    try {
      const keys = await this.listKeys();
      const signingKey = findSigningKey(keys);
      if (!signingKey) throw new NoKeysFoundError();

      if (this.identifiedCa) {
        await this.fetchAndAddUserCerts(keys, [this.identifiedCa.cmpUrl]);
      } else {
        await this.fetchAndAddUserCerts(keys);
      }

      const selectResult = await this.callMethod("SELECT_KEY", {
        id: signingKey.id,
      });
      const certBase64 = selectResult.result?.certificate as string | undefined;
      if (!certBase64) {
        throw new StorageError("SELECT_KEY did not return a certificate");
      }

      const certInfo = await this.getCertInfo(certBase64);

      const signOverrides: { signAlgo?: string; digestAlgo?: string } = {};
      if (options.signAlgo !== undefined) {
        signOverrides.signAlgo = options.signAlgo;
      }
      if (options.digestAlgo !== undefined) {
        signOverrides.digestAlgo = options.digestAlgo;
      }
      const { signAlgo, digestAlgo } = resolveSignParams(
        certInfo.algorithm,
        signOverrides,
      );

      const signResult = await this.callMethod("SIGN", {
        signParams: {
          signatureFormat: options.signatureFormat ?? "CAdES-XL",
          signAlgo,
          digestAlgo,
          detachedData: options.isDetached ?? true,
          includeCert: options.includeCert ?? true,
          includeTime: options.includeTime ?? true,
          includeContentTs: options.includeContentTs ?? false,
        },
        dataTbs: [{ id: "doc-0", bytes: uint8ToBase64(data) }],
      });

      if (signResult.errorCode !== 0) {
        throw new SignFailedError(
          signResult.error || `SIGN failed: ${String(signResult.errorCode)}`,
          signResult.errorCode,
        );
      }

      const signatures = signResult.result?.signatures as
        Array<{ bytes: string }> | undefined;
      const p7sBase64 = signatures?.[0]?.bytes ?? "";

      if (!p7sBase64) {
        throw new SignFailedError("SIGN returned no signature data");
      }

      return { p7sBase64, certDerBase64: certBase64, certInfo };
    } finally {
      await this.closeStorage();
    }
  }

  /**
   * Parse certificate info from a DER-encoded cert (base64).
   */
  async getCertInfo(certBase64: string): Promise<CertInfo> {
    this.assertInitialized();
    const result = await this.callMethod("CERT_INFO", { bytes: certBase64 });
    return parseCertInfo(result.result ?? {});
  }

  /**
   * Clean up resources. Must be called when done signing.
   */
  async destroy(): Promise<void> {
    await this.adapter.destroy();
    this.identifiedCa = null;
    this.initialized = false;
  }

  private async init(): Promise<void> {
    const initOptions: AdapterInitOptions = {};
    if (this.options.corsProxyUrl !== undefined) {
      initOptions.corsProxyUrl = this.options.corsProxyUrl;
    }
    if (this.options.wasmLocateFile !== undefined) {
      initOptions.wasmLocateFile = this.options.wasmLocateFile;
    }
    await this.adapter.initialize(initOptions);

    this.initialized = true;

    if (this.options.corsProxyUrl) {
      try {
        if (this.options.caRegistryUrl !== undefined) {
          await loadCaRegistry(
            this.options.corsProxyUrl,
            this.options.caRegistryUrl,
          );
        } else {
          await loadCaRegistry(this.options.corsProxyUrl);
        }
        await this.loadCaCerts(this.options.corsProxyUrl);
      } catch {
        // CA cert loading is best-effort; signing may work with limited validation
      }
    }
  }

  private async loadCaCerts(corsProxyUrl: string): Promise<void> {
    const bundleB64 =
      this.options.caBundleUrl !== undefined
        ? await fetchCaCertBundle(corsProxyUrl, this.options.caBundleUrl)
        : await fetchCaCertBundle(corsProxyUrl);
    if (bundleB64) {
      const result = await this.callMethod("ADD_CERT", { bundle: bundleB64 });
      if (result.errorCode === 0) return;
    }

    const caCerts =
      this.options.caBundleUrl !== undefined
        ? await fetchCaCerts(corsProxyUrl, this.options.caBundleUrl)
        : await fetchCaCerts(corsProxyUrl);
    for (const cert of caCerts) {
      await this.callMethod("ADD_CERT", {
        certificates: [uint8ToBase64(cert)],
      });
    }
  }

  private get keyPath(): string {
    const base = this.adapter.tempDir;
    return base ? `${base}uapki/keystore` : "/tmp/keystore";
  }

  private async openStorage(
    keyBytes: Uint8Array,
    password: string,
  ): Promise<void> {
    await this.adapter.writeFile(this.keyPath, keyBytes);

    const result = await this.callMethod("OPEN", {
      provider: "PKCS12",
      storage: this.keyPath,
      password,
      mode: "RO",
    });

    if (result.errorCode !== 0) {
      await this.adapter.deleteFile(this.keyPath);
      if (WRONG_PASSWORD_CODES.has(result.errorCode)) {
        throw new InvalidPasswordError();
      }
      throw new StorageError(
        result.error || `OPEN failed: ${String(result.errorCode)}`,
        result.errorCode,
      );
    }
  }

  private async listKeys(): Promise<KeyInfo[]> {
    const resp = await this.callMethod("KEYS");
    if (resp.errorCode !== 0) {
      throw new StorageError(
        resp.error || `KEYS failed: ${String(resp.errorCode)}`,
        resp.errorCode,
      );
    }
    return (resp.result?.keys as KeyInfo[] | undefined) ?? [];
  }

  private async closeStorage(): Promise<void> {
    try {
      await this.callMethod("CLOSE");
    } catch {
      // best effort
    }
    await this.adapter.deleteFile(this.keyPath);
  }

  private async fetchAndAddUserCerts(
    keys: KeyInfo[],
    cmpUrls?: string[],
  ): Promise<void> {
    if (!this.options.corsProxyUrl) return;

    try {
      const keyIds = keys.map((k) => k.id);
      const urls = cmpUrls ?? getAllCmpUrls();

      const certs = await fetchUserCerts(
        keyIds,
        urls,
        this.options.corsProxyUrl,
      );
      for (const certBytes of certs) {
        await this.callMethod("ADD_CERT", {
          certificates: [uint8ToBase64(certBytes)],
        });
      }
    } catch {
      // CMP fetch is best-effort; signing may still succeed
    }
  }

  private async callMethod(
    method: string,
    parameters?: Record<string, unknown>,
  ): Promise<UapkiResponse> {
    const request = JSON.stringify({ method, parameters });
    return this.adapter.process(request);
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new InitializationError(
        "DocumentSigner not initialized. Use DocumentSigner.create().",
      );
    }
  }
}

function findSigningKey(keys: KeyInfo[]): KeyInfo | undefined {
  return (
    keys.find((k) => k.label?.includes("підпис")) ??
    keys.find((k) => !k.label?.includes("шифрування")) ??
    keys[0]
  );
}

function parseCertInfo(certResult: Record<string, unknown>): CertInfo {
  const subject = certResult.subject as Record<string, string> | undefined;
  const issuer = certResult.issuer as Record<string, string> | undefined;
  const validity = certResult.validity as
    { notBefore?: string; notAfter?: string } | undefined;
  const spki = certResult.subjectPublicKeyInfo as
    { algorithm?: string } | undefined;

  return {
    commonName: subject?.CN ?? "",
    organization: subject?.O ?? "",
    issuer: issuer?.CN ?? "",
    serialNumber:
      typeof certResult.serialNumber === "string"
        ? certResult.serialNumber
        : "",
    validFrom: validity?.notBefore ?? "",
    validUntil: validity?.notAfter ?? "",
    algorithm: spki?.algorithm ?? "",
  };
}
