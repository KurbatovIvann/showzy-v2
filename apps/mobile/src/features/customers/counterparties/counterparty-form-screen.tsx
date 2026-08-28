import { useLocalSearchParams } from "expo-router";

import { CounterpartyFormView } from "./counterparty-form-view";
import { useCounterpartyForm } from "./use-counterparty-form";

export function CounterpartyCreateScreen() {
  const params = useLocalSearchParams<{
    customerId: string | string[];
  }>();
  const model = useCounterpartyForm({
    mode: "create",
    ...(params.customerId === undefined
      ? {}
      : { customerIdParam: params.customerId }),
  });
  return <CounterpartyFormView {...model} />;
}

export function CounterpartyEditScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useCounterpartyForm({ mode: "edit", idParam: id });
  return <CounterpartyFormView {...model} />;
}
