import {
  AssistantSheetView,
  AssistantUnavailableView,
} from "./assistant-sheet-view";
import { useAssistantSheet } from "./use-assistant-sheet";

export function AssistantSheetScreen() {
  const model = useAssistantSheet();
  if (!model.ready) {
    return (
      <AssistantUnavailableView
        title={model.copy.sheetTitle}
        description={model.copy.errors.unavailable}
      />
    );
  }
  return <AssistantSheetView {...model} />;
}
