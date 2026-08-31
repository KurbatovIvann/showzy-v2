export { DocumentSigner } from "./document-signer.js";

export type {
  CertInfo,
  KeyInfo,
  ValidateKeyResult,
  SignatureFormat,
  SignOptions,
  SignResult,
  VerifyResult,
  DocumentSignerOptions,
  UapkiRequest,
  UapkiResponse,
} from "./types.js";

export type { UapkiAdapter, AdapterInitOptions } from "./platform/adapter.js";

export { PKI_PROXY_PATH } from "./pki/proxy.js";
export {
  PKI_PROXY_ALLOWED_HOSTS,
  isPkiProxyAllowedHost,
} from "./pki/allowlist.js";

export {
  SigningError,
  InitializationError,
  StorageError,
  InvalidPasswordError,
  NoKeysFoundError,
  CertExpiredError,
  SignFailedError,
  AsicContainerError,
  UapkiProtocolError,
  VerifyFailedError,
} from "./errors.js";

export { setPkiDebugLog, type PkiDebugLog } from "./pki/debug-log.js";

export type { CaProvider } from "./pki/ca-registry.js";

export {
  OID_DSTU4145_GOST_PB,
  OID_DSTU4145_KUPYNA256_PB,
  OID_DSTU7564_256,
  OID_GOST34311,
  XML_DIGEST_URI_GOST34311,
  XML_DIGEST_URI_KUPYNA256,
  hashOidFromDigestUri,
  resolveSignParams,
  signingAlgosFromCertAlgorithm,
  xmlDigestUriForHashOid,
} from "./pki/algorithms.js";
