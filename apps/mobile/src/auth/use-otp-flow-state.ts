import { useCallback, useSyncExternalStore } from "react";

import {
  initialOtpFlowState,
  type OtpFlow,
  type OtpFlowState,
} from "./otp-flow";

/** Stable fallback so getSnapshot never loops when the flow is absent
 * (config error). */
const emptyState = initialOtpFlowState();

export function useOtpFlowState(flow: OtpFlow | null): OtpFlowState {
  const subscribe = useCallback(
    (listener: () => void) =>
      flow === null ? () => undefined : flow.subscribe(listener),
    [flow],
  );
  const getSnapshot = useCallback(
    () => (flow === null ? emptyState : flow.get()),
    [flow],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
