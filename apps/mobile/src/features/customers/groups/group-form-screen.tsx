import { useLocalSearchParams } from "expo-router";

import { GroupFormView } from "./group-form-view";
import { useGroupForm } from "./use-group-form";

export function GroupCreateScreen() {
  const model = useGroupForm({ mode: "create" });
  return <GroupFormView {...model} />;
}

export function GroupEditScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const model = useGroupForm({ mode: "edit", idParam: id });
  return <GroupFormView {...model} />;
}
