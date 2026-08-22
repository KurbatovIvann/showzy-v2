/**
 * Ready-file view returned by finalize. Deliberately omits object keys and
 * signed URLs (security-operations.md §3).
 */
import { z } from "zod";

import {
  checksumSha256Schema,
  fileMimeTypeSchema,
  filePurposeSchema,
  uploadByteSizeSchema,
} from "../wire.contract.js";

export const fileReadyViewSchema = z.object({
  fileId: z.uuid(),
  status: z.literal("ready"),
  purpose: filePurposeSchema,
  mimeType: fileMimeTypeSchema,
  byteSize: uploadByteSizeSchema,
  checksumSha256: checksumSha256Schema,
});
