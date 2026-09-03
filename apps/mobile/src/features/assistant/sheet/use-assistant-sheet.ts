import { useMemo } from "react";

import { assistantCopy } from "../../../i18n/assistant";
import { detectLocale } from "../../../i18n/locale";
import { assistantChatRows } from "../shared/chat-rows";
import {
  assistantChatErrorKind,
  assistantChatErrorMessage,
} from "../shared/chat-error";
import type { AssistantSheetViewModel } from "./assistant-sheet-view";
import { useAssistantChat } from "./use-assistant-chat";
import { useAssistantConfirmation } from "./use-assistant-confirmation";

export function useAssistantSheet(): AssistantSheetViewModel & {
  readonly ready: boolean;
} {
  const copy = useMemo(() => assistantCopy(detectLocale()), []);
  const chat = useAssistantChat();
  const confirmation = useAssistantConfirmation({
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    sendBusy: chat.sendBusy,
    resume: chat.resume,
  });
  chat.confirmationResetRef.current = confirmation.reset;

  const rows = assistantChatRows(
    chat.messages,
    confirmation.card.kind === "hidden" ? null : confirmation.card.confirmation,
    copy,
    confirmation.ignoredChallengeIds,
  );

  const chatKind =
    chat.error !== undefined ? assistantChatErrorKind(chat.error) : null;
  const bannerKind = chat.createErrorKind ?? chatKind;
  const banner =
    bannerKind === null ? null : assistantChatErrorMessage(bannerKind, copy);

  return {
    ready: chat.ready,
    copy,
    rows,
    input: chat.input,
    changeInput: chat.changeInput,
    send: chat.send,
    confirm: confirmation.confirm,
    dismiss: confirmation.dismiss,
    busy: chat.sendBusy,
    thinking: chat.thinking,
    confirmationApplying: confirmation.card.kind === "applying",
    canSend: chat.canSend,
    banner,
  };
}
