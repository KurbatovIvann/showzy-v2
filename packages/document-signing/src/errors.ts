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
