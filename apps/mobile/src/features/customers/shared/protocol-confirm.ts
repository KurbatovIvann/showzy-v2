import { describeWireError } from "../../../../api/errors";

/**
 * High-risk list writes (`deleteCustomer`, `deleteGroup`) declare
 * `requiresConfirmation`. After the UI confirm, the first submit returns
 * `CONFIRMATION_REQUIRED`; this helper re-invokes with the challenge so
 * the protocol is real, not just a local Alert.
 */
export function confirmationChallengeId(error: unknown): string | null {
  const view = describeWireError(error);
  if (view === null || view.code !== "CONFIRMATION_REQUIRED") {
    return null;
  }
  return view.challengeId ?? null;
}

export async function submitWithProtocolConfirmation<T>(args: {
  readonly submit: () => Promise<T>;
  readonly confirm: (challengeId: string) => Promise<T>;
}): Promise<T> {
  try {
    return await args.submit();
  } catch (error) {
    const challengeId = confirmationChallengeId(error);
    if (challengeId === null) {
      throw error;
    }
    return args.confirm(challengeId);
  }
}
