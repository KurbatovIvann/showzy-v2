/**
 * Zod boundary for JSON coming back from the UAPKI engine (SHO-282).
 * Adapters parse the envelope once; callers parse the method-specific
 * `result` they read. Schemas are loose on purpose — UAPKI adds fields
 * freely — but a value that is read must have the documented type, and a
 * malformed response becomes a typed `UapkiProtocolError`, never a
 * downstream TypeError.
 */
import { z } from "zod";

import { UapkiProtocolError } from "../errors.js";
import type { UapkiResponse } from "../types.js";

const uapkiResponseSchema = z.looseObject({
  errorCode: z.number(),
  error: z.string().optional(),
  method: z.string().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
});

/** Parse a raw JSON string from an adapter transport into `UapkiResponse`. */
export function parseUapkiResponseJson(
  jsonText: string,
  context: string,
): UapkiResponse {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new UapkiProtocolError(`${context}: UAPKI returned invalid JSON`);
  }
  return parseUapkiResponseValue(raw, context);
}

/** Parse an already-deserialized value (worker postMessage payloads). */
export function parseUapkiResponseValue(
  raw: unknown,
  context: string,
): UapkiResponse {
  const parsed = uapkiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UapkiProtocolError(
      `${context}: UAPKI response does not match the envelope shape`,
    );
  }
  const { errorCode, error, method, result } = parsed.data;
  return {
    errorCode,
    method: method ?? "",
    ...(error !== undefined ? { error } : {}),
    ...(result !== undefined ? { result } : {}),
  };
}

const keyInfoSchema = z.looseObject({
  id: z.string(),
  mechanismId: z.string().optional(),
  parameterId: z.string().optional(),
  label: z.string().optional(),
  application: z.string().optional(),
  signAlgo: z.array(z.string()).optional(),
});

export const selectKeyResultSchema = z.looseObject({
  certificate: z.string().optional(),
});

export const keysResultSchema = z.looseObject({
  keys: z.array(keyInfoSchema).optional(),
});

export const signResultSchema = z.looseObject({
  signatures: z
    .array(z.looseObject({ bytes: z.string().optional() }))
    .optional(),
});

export const digestResultSchema = z.looseObject({
  bytes: z.string().optional(),
});

export const certInfoResultSchema = z.looseObject({
  subject: z.record(z.string(), z.unknown()).optional(),
  issuer: z.record(z.string(), z.unknown()).optional(),
  validity: z
    .looseObject({
      notBefore: z.string().optional(),
      notAfter: z.string().optional(),
    })
    .optional(),
  subjectPublicKeyInfo: z
    .looseObject({ algorithm: z.string().optional() })
    .optional(),
  serialNumber: z.string().optional(),
  keyAlgo: z.string().optional(),
});

export const signatureInfoSchema = z.looseObject({
  statusSignature: z.string().optional(),
  statusMessageDigest: z.string().optional(),
  signerCertId: z.string().optional(),
  signAlgo: z.string().optional(),
  signingTime: z.unknown().optional(),
  bestSignatureTime: z.unknown().optional(),
});

export const verifyResultSchema = z.looseObject({
  signatureInfos: z.array(signatureInfoSchema).optional(),
});

export type SignatureInfo = z.infer<typeof signatureInfoSchema>;

/**
 * Parse the method-specific `result` of a successful call. `undefined`
 * (no result at all) parses as an empty object so callers keep their
 * "field missing" handling.
 */
export function parseUapkiResult<Schema extends z.ZodType>(
  schema: Schema,
  method: string,
  result: Record<string, unknown> | undefined,
): z.output<Schema> {
  const parsed = schema.safeParse(result ?? {});
  if (!parsed.success) {
    throw new UapkiProtocolError(
      `${method}: UAPKI result does not match the documented shape`,
    );
  }
  return parsed.data;
}
