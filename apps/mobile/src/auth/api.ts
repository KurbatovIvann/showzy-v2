/**
 * better-auth HTTP client for Expo (contract.md §3 bearer, ADR-0006).
 * Paths match `apps/api` OTP tests. OTP codes are never copied into errors.
 */
import {
  AuthClientError,
  classifyAuthHttpStatus,
  parseRetryAfterSec,
  type AuthHttpOperation,
} from "./errors";
import type { ParsedIdentifier } from "./identifiers";

export const AUTH_PREFIX = "/api/auth";

export interface AuthSessionUser {
  readonly userId: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
}

export interface GetSessionResult {
  readonly user: AuthSessionUser | null;
  readonly rotatedToken: string | null;
}

export interface AuthApi {
  sendOtp(identifier: ParsedIdentifier): Promise<void>;
  verifyOtp(identifier: ParsedIdentifier, code: string): Promise<string>;
  getSession(token: string): Promise<GetSessionResult>;
  signOut(token: string): Promise<void>;
}

export interface AuthApiOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
}

export function createAuthApi(options: AuthApiOptions): AuthApi {
  const fetchImpl = options.fetch ?? fetch;
  const origin = originOf(options.baseUrl);

  async function request(
    path: string,
    init: {
      readonly method: "GET" | "POST";
      readonly operation: AuthHttpOperation;
      readonly body?: unknown;
      readonly token?: string;
    },
  ): Promise<Response> {
    const headers = new Headers({
      origin,
      accept: "application/json",
    });
    if (init.body !== undefined) {
      headers.set("content-type", "application/json");
    }
    if (init.token !== undefined && init.token !== "") {
      headers.set("authorization", `Bearer ${init.token}`);
    }
    let response: Response;
    try {
      response = await fetchImpl(
        new Request(authUrl(options.baseUrl, path), {
          method: init.method,
          headers,
          credentials: "omit",
          ...(init.body === undefined
            ? {}
            : { body: JSON.stringify(init.body) }),
        }),
      );
    } catch {
      throw new AuthClientError("network");
    }
    if (!response.ok) {
      throw new AuthClientError(
        classifyAuthHttpStatus(response.status, init.operation),
        parseRetryAfterSec(response.headers),
      );
    }
    return response;
  }

  return {
    async sendOtp(identifier) {
      if (identifier.channel === "phone") {
        await request("/phone-number/send-otp", {
          method: "POST",
          operation: "send",
          body: { phoneNumber: identifier.phoneNumber },
        });
        return;
      }
      await request("/email-otp/send-verification-otp", {
        method: "POST",
        operation: "send",
        body: { email: identifier.email, type: "sign-in" },
      });
    },

    async verifyOtp(identifier, code) {
      const response =
        identifier.channel === "phone"
          ? await request("/phone-number/verify", {
              method: "POST",
              operation: "verify",
              body: { phoneNumber: identifier.phoneNumber, code },
            })
          : await request("/email-otp/verify-email", {
              method: "POST",
              operation: "verify",
              body: { email: identifier.email, otp: code },
            });
      const token = await tokenFromVerify(response);
      if (token === null) {
        throw new AuthClientError("unavailable");
      }
      return token;
    },

    async getSession(token) {
      const response = await request("/get-session", {
        method: "GET",
        operation: "session",
        token,
      });
      const payload: unknown = await readJson(response);
      return {
        user: parseSessionUser(payload),
        rotatedToken: tokenFromHeaders(response.headers),
      };
    },

    async signOut(token) {
      await request("/sign-out", {
        method: "POST",
        operation: "session",
        token,
      });
    },
  };
}

export function authUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${AUTH_PREFIX}${path}`;
}

function originOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function tokenFromVerify(response: Response): Promise<string | null> {
  const payload = await readJson(response);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "token" in payload &&
    typeof payload.token === "string" &&
    payload.token !== ""
  ) {
    return payload.token;
  }
  return tokenFromHeaders(response.headers);
}

function tokenFromHeaders(headers: Headers): string | null {
  const header =
    headers.get("set-auth-token") ?? headers.get("set-auth-jwt") ?? "";
  return header === "" ? null : header;
}

function parseSessionUser(payload: unknown): AuthSessionUser | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const userCandidate =
    typeof record.user === "object" && record.user !== null
      ? (record.user as Record<string, unknown>)
      : record;
  if (typeof userCandidate.id !== "string" || userCandidate.id === "") {
    return null;
  }
  return {
    userId: userCandidate.id,
    email: stringOrNull(userCandidate.email),
    phoneNumber: stringOrNull(userCandidate.phoneNumber),
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
