import { useMutation } from "@tanstack/react-query";

import { useAuthClient } from "../session-provider";
import { authErrorFromUnknown } from "../errors";
import type { ParsedIdentifier } from "./identifiers";

export function useSendOtpMutation() {
  const authClient = useAuthClient();
  return useMutation({
    mutationFn: async (identifier: ParsedIdentifier) => {
      try {
        const result =
          identifier.channel === "phone"
            ? await authClient.phoneNumber.sendOtp({
                phoneNumber: identifier.phoneNumber,
              })
            : await authClient.emailOtp.sendVerificationOtp({
                email: identifier.email,
                type: "sign-in",
              });
        if (result.error) {
          throw authErrorFromUnknown(result.error, "send");
        }
      } catch (error) {
        throw authErrorFromUnknown(error, "send");
      }
    },
  });
}

export function useVerifyOtpMutation() {
  const authClient = useAuthClient();
  return useMutation({
    mutationFn: async (input: {
      readonly identifier: ParsedIdentifier;
      readonly code: string;
    }) => {
      try {
        const result =
          input.identifier.channel === "phone"
            ? await authClient.phoneNumber.verify({
                phoneNumber: input.identifier.phoneNumber,
                code: input.code,
              })
            : await authClient.signIn.emailOtp({
                email: input.identifier.email,
                otp: input.code,
              });
        if (result.error) {
          throw authErrorFromUnknown(result.error, "verify");
        }
        // Phone/email OTP verify is not a `/sign-in/*` path, so the
        // session atom may not update from the verify response alone.
        await authClient.getSession();
      } catch (error) {
        throw authErrorFromUnknown(error, "verify");
      }
    },
  });
}
