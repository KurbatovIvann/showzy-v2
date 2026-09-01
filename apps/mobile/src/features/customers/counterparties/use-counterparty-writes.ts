/**
 * Counterparty delete + edit navigation (SHO-195 / SHO-307). Delete is
 * UI confirm then protocol confirmation. Callbacks are ref-stable.
 */
import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "expo-router";

import type { CustomersCopy } from "../../../i18n/customers";
import { counterpartyEditorHref } from "../shared/customer-hrefs";
import { useCounterpartyDeleteWrite } from "../shared/use-counterparty-delete-write";

export function useCounterpartyWrites(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const writes = useCounterpartyDeleteWrite(args);

  const openEdit = useCallback((id: string) => {
    routerRef.current.push(counterpartyEditorHref(id));
  }, []);

  return useMemo(
    () => ({
      banner: writes.banner,
      pending: writes.pending,
      openEdit,
      remove: writes.remove,
    }),
    [writes.banner, writes.pending, writes.remove, openEdit],
  );
}
