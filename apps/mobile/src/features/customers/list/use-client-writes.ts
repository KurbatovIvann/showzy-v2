/**
 * Client archive / restore / delete + navigation (SHO-179 / SHO-307).
 * Mutations live in `useCustomerStatusWrites`; this wrapper adds edit
 * navigation with a stable callback identity.
 */
import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "expo-router";

import type { CustomersCopy } from "../../../i18n/customers";
import { customerEditorHref } from "../shared/customer-hrefs";
import { useCustomerStatusWrites } from "../shared/use-customer-status-writes";

export function useClientWrites(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const writes = useCustomerStatusWrites(args);

  const openEdit = useCallback((id: string) => {
    routerRef.current.push(customerEditorHref(id));
  }, []);

  return useMemo(
    () => ({
      banner: writes.banner,
      pending: writes.pending,
      openEdit,
      archive: writes.archive,
      restore: writes.restore,
      remove: writes.remove,
    }),
    [
      writes.banner,
      writes.pending,
      writes.archive,
      writes.restore,
      writes.remove,
      openEdit,
    ],
  );
}
