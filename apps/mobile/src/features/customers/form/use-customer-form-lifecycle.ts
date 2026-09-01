/**
 * Archive / restore / delete on the client editor (SHO-180 / SHO-307).
 * Reuses list mutations; after a successful write the form arms leave.
 */
import { useCallback, useMemo, useRef } from "react";

import type { CustomersCopy } from "../../../i18n/customers";
import { useCustomerStatusWrites } from "../shared/use-customer-status-writes";

export function useCustomerFormLifecycle(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly customerId: string | null;
  readonly armLeave: () => void;
}): {
  readonly banner: string | null;
  readonly pending: boolean;
  readonly archive: () => Promise<void>;
  readonly restore: () => Promise<void>;
  readonly remove: () => Promise<void>;
} {
  const argsRef = useRef(args);
  argsRef.current = args;
  const writes = useCustomerStatusWrites({
    copy: args.copy,
    canEdit: args.canEdit,
    canDelete: args.canDelete,
    afterSuccess: () => {
      argsRef.current.armLeave();
    },
  });

  const archive = useCallback(async () => {
    const id = argsRef.current.customerId;
    if (id === null) {
      return;
    }
    await writes.archive(id);
  }, [writes.archive]);

  const restore = useCallback(async () => {
    const id = argsRef.current.customerId;
    if (id === null) {
      return;
    }
    await writes.restore(id);
  }, [writes.restore]);

  const remove = useCallback(async () => {
    const id = argsRef.current.customerId;
    if (id === null) {
      return;
    }
    await writes.remove(id);
  }, [writes.remove]);

  return useMemo(
    () => ({
      banner: writes.banner,
      pending: writes.pending,
      archive,
      restore,
      remove,
    }),
    [writes.banner, writes.pending, archive, restore, remove],
  );
}
