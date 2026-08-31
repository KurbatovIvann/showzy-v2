export class SigningError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly uapkiErrorCode?: number,
  ) {
    super(message);
    this.name = "SigningError";
  }
}

export class InitializationError extends SigningError {
  constructor(message: string, uapkiErrorCode?: number) {
    super(message, "INIT_FAILED", uapkiErrorCode);
    this.name = "InitializationError";
  }
}

export class StorageError extends SigningError {
  constructor(message: string, uapkiErrorCode?: number) {
    super(message, "STORAGE_ERROR", uapkiErrorCode);
    this.name = "StorageError";
  }
}

export class InvalidPasswordError extends SigningError {
  constructor() {
    super("Invalid password for key container", "INVALID_PASSWORD");
    this.name = "InvalidPasswordError";
  }
}

export class NoKeysFoundError extends SigningError {
  constructor() {
    super("No signing keys found in the container", "NO_KEYS_FOUND");
    this.name = "NoKeysFoundError";
  }
}

export class CertExpiredError extends SigningError {
  constructor(public readonly validUntil: string) {
    super(`Certificate expired on ${validUntil}`, "CERT_EXPIRED");
    this.name = "CertExpiredError";
  }
}

export class SignFailedError extends SigningError {
  constructor(message: string, uapkiErrorCode?: number) {
    super(message, "SIGN_FAILED", uapkiErrorCode);
    this.name = "SignFailedError";
  }
}

export class AsicContainerError extends SigningError {
  constructor(message: string) {
    super(message, "ASIC_INVALID");
    this.name = "AsicContainerError";
  }
}

export class VerifyFailedError extends SigningError {
  constructor(message: string, uapkiErrorCode?: number) {
    super(message, "VERIFY_FAILED", uapkiErrorCode);
    this.name = "VerifyFailedError";
  }
}

/**
 * The UAPKI engine (or its transport) returned JSON that does not match
 * the documented response shape (SHO-282). A malformed response is a typed
 * failure at the boundary, never a downstream TypeError.
 */
export class UapkiProtocolError extends SigningError {
  constructor(message: string) {
    super(message, "UAPKI_PROTOCOL");
    this.name = "UapkiProtocolError";
  }
}
