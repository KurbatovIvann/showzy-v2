/**
 * Delete on the counterparty editor (SHO-196 / SHO-307). Permission is
 * `customers:edit` (not `customers:delete`). Reuses list delete writes;
 * after a successful write the form arms leave.
 */
import { useCallback, useMemo, useRef } from "react";

import type { CustomersCopy } from "../../../i18n/customers";
import { useCounterpartyDeleteWrite } from "../shared/use-counterparty-delete-write";

export function useCounterpartyFormLifecycle(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly counterpartyId: string | null;
  readonly armLeave: () => void;
}): {
  readonly banner: string | null;
  readonly pending: boolean;
  readonly remove: () => Promise<void>;
} {
  const argsRef = useRef(args);
  argsRef.current = args;
  const writes = useCounterpartyDeleteWrite({
    copy: args.copy,
    canEdit: args.canEdit,
    afterSuccess: () => {
      argsRef.current.armLeave();
    },
  });

  const remove = useCallback(async () => {
    const id = argsRef.current.counterpartyId;
    if (id === null) {
      return;
    }
    await writes.remove(id);
  }, [writes.remove]);

  return useMemo(
    () => ({
      banner: writes.banner,
      pending: writes.pending,
      remove,
    }),
    [writes.banner, writes.pending, remove],
  );
}
