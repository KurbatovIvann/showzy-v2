import { NotFoundError } from "@showzy/core/errors";

export type GenerationArtifact = {
  readonly status: "pending" | "ready" | "failed";
  readonly fileId: string | null;
};

/**
 * Maps a missing generation job to the panel's pending chip. Other errors
 * propagate. `documents.get` / `documents.share` must not query jobs.
 */
export async function loadGenerationArtifact(env: {
  readonly documentId: string;
  readonly getArtifact: (input: {
    readonly documentId: string;
  }) => Promise<GenerationArtifact>;
}): Promise<GenerationArtifact> {
  try {
    return await env.getArtifact({ documentId: env.documentId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { status: "pending", fileId: null };
    }
    throw error;
  }
}

export function readyArtifactFileId(
  artifact: GenerationArtifact,
): string | null {
  if (artifact.status !== "ready") {
    return null;
  }
  return artifact.fileId;
}
