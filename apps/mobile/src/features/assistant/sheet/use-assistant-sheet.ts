import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";

import { assistantCopy } from "../../../i18n/assistant";
import { detectLocale } from "../../../i18n/locale";
import {
  assistantChatErrorKind,
  assistantChatErrorMessage,
} from "../shared/chat-error";
import {
  assistantChatRows,
  assistantDisplayRows,
  assistantRowHasInFlightTools,
  assistantTurnIsWaiting,
} from "../shared/chat-rows";
import type { AssistantSheetViewModel } from "./assistant-sheet-view";
import { useAssistantChat } from "./use-assistant-chat";
import { useAssistantConfirmation } from "./use-assistant-confirmation";

export function useAssistantSheet(): AssistantSheetViewModel & {
  readonly ready: boolean;
} {
  const locale = detectLocale();
  const copy = useMemo(() => assistantCopy(locale), [locale]);
  const { push } = useRouter();
  const chat = useAssistantChat();
  const confirmation = useAssistantConfirmation({
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    sendBusy: chat.sendBusy,
    resume: chat.resume,
  });
  chat.confirmationResetRef.current = confirmation.reset;

  const openHref = useCallback(
    (href: string) => {
      push(href);
    },
    [push],
  );

  const pendingConfirmation =
    confirmation.card.kind === "hidden" ? null : confirmation.card.confirmation;

  const mappedRows = assistantChatRows(
    chat.messages,
    pendingConfirmation,
    copy,
    confirmation.ignoredChallengeIds,
    locale,
  );
  const liveWaiting = assistantTurnIsWaiting({
    status: chat.status,
    confirmation: pendingConfirmation,
  });
  const rows = assistantDisplayRows(mappedRows, liveWaiting);
  const lastMapped = mappedRows[mappedRows.length - 1];
  const hasInFlightTools =
    lastMapped !== undefined && assistantRowHasInFlightTools(lastMapped);

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
    openHref,
    busy: chat.sendBusy,
    thinking: chat.thinking,
    hasInFlightTools,
    confirmationApplying: confirmation.card.kind === "applying",
    canSend: chat.canSend,
    banner,
  };
}
