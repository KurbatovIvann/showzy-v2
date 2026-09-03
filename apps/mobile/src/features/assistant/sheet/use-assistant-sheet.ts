import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";

import { assistantCopy } from "../../../i18n/assistant";
import { detectLocale } from "../../../i18n/locale";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  assistantChatErrorKind,
  assistantChatErrorMessage,
} from "../shared/chat-error";
import { assistantChatRows } from "../shared/chat-rows";
import { ASSISTANT_ORDERS_LIST_HREF } from "../shared/result-cards";
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

  const openOrders = useCallback(() => {
    push(ASSISTANT_ORDERS_LIST_HREF);
  }, [push]);
  const openOrder = useCallback(
    (orderId: string) => {
      push(orderDetailHref(orderId));
    },
    [push],
  );

  const rows = assistantChatRows(
    chat.messages,
    confirmation.card.kind === "hidden" ? null : confirmation.card.confirmation,
    copy,
    confirmation.ignoredChallengeIds,
    locale,
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
    openOrders,
    openOrder,
    busy: chat.sendBusy,
    thinking: chat.thinking,
    confirmationApplying: confirmation.card.kind === "applying",
    canSend: chat.canSend,
    banner,
  };
}
