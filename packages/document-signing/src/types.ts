export interface CertInfo {
  commonName: string;
  organization: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validUntil: string;
  algorithm: string;
}

export interface KeyInfo {
  id: string;
  mechanismId?: string;
  parameterId?: string;
  label?: string;
  application?: string;
  signAlgo?: string[];
}

export interface ValidateKeyResult {
  certInfo: CertInfo;
  keys: KeyInfo[];
}

export type SignatureFormat = "CAdES-BES" | "CAdES-T" | "CAdES-XL";

export interface SignOptions {
  isDetached?: boolean;
  signatureFormat?: SignatureFormat;
  signAlgo?: string;
  digestAlgo?: string;
  includeCert?: boolean;
  includeTime?: boolean;
  includeContentTs?: boolean;
}

export interface SignResult {
  p7sBase64: string;
  certDerBase64: string;
  certInfo: CertInfo;
}

export interface VerifyResult {
  isValid: boolean;
  signerInfo?: CertInfo;
  signatureFormat?: string;
  error?: string;
}

export interface DocumentSignerOptions {
  corsProxyUrl?: string;
  tspUrl?: string;
  caRegistryUrl?: string;
  caBundleUrl?: string;
  wasmLocateFile?: (path: string) => string;
}

export interface UapkiRequest {
  method: string;
  parameters?: Record<string, unknown>;
}

export interface UapkiResponse {
  errorCode: number;
  error?: string;
  method: string;
  result?: Record<string, unknown>;
}
