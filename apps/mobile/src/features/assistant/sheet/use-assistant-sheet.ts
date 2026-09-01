import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { apiUrlFromEnv } from "../../../api/config";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useBoundContractMutation } from "../../../api/use-bound-contract-mutation";
import { useAuthSession } from "../../../auth/session-provider";
import { assistantCopy } from "../../../i18n/assistant";
import { detectLocale } from "../../../i18n/locale";
import { clipAssistantInput } from "../api/assistant-chat-body";
import {
  createStaffAssistantTransport,
  type StaffAssistantUiMessage,
} from "../api/assistant-chat-transport";
import { bindCreateConversationMutate } from "../api/create-conversation";
import { assistantChatRows } from "../shared/chat-rows";
import {
  assistantChatErrorKind,
  assistantChatErrorMessage,
  queryFailureToAssistantKind,
} from "../shared/chat-error";
import {
  confirmationCardState,
  executeConfirmationConfirm,
  executeConfirmationDismiss,
  pendingConfirmationFromMessages,
  type AssistantChatMessage,
} from "../shared/confirmation-presenter";
import type { AssistantSheetViewModel } from "./assistant-sheet-view";

function resolveApiUrl(): string | null {
  try {
    return apiUrlFromEnv();
  } catch {
    return null;
  }
}

export function useAssistantSheet(): AssistantSheetViewModel & {
  readonly ready: boolean;
} {
  const copy = useMemo(() => assistantCopy(detectLocale()), []);
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const apiUrl = useMemo(() => resolveApiUrl(), []);

  const cookieRef = useRef(auth.getCookie);
  cookieRef.current = auth.getCookie;
  const companyIdRef = useRef(activeCompanyId);
  companyIdRef.current = activeCompanyId;
  const conversationIdRef = useRef<string | null>(null);

  const [input, setInput] = useState("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [resolved, setResolved] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [resolvingChallengeId, setResolvingChallengeId] = useState<
    string | null
  >(null);

  const createConversation = useBoundContractMutation(
    bindCreateConversationMutate,
  );

  const transport = useMemo(
    () =>
      createStaffAssistantTransport({
        apiUrl: apiUrl ?? "http://127.0.0.1",
        getCookie: () => cookieRef.current(),
        getCompanyId: () => companyIdRef.current,
        getConversationId: () => conversationIdRef.current,
      }),
    [apiUrl],
  );

  const { messages, sendMessage, status, error, clearError } =
    useChat<StaffAssistantUiMessage>({
      transport,
      onError: () => {
        setResolvingChallengeId(null);
      },
    });

  const previousStatus = useRef(status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    const wasBusy = previous === "submitted" || previous === "streaming";
    if (status !== "ready" || !wasBusy || resolvingChallengeId === null) {
      return;
    }
    setResolved((current) => {
      const next = new Set(current);
      next.add(resolvingChallengeId);
      return next;
    });
    setResolvingChallengeId(null);
  }, [status, resolvingChallengeId]);

  const ignored = useMemo(() => {
    const next = new Set(dismissed);
    for (const challengeId of resolved) {
      next.add(challengeId);
    }
    return next;
  }, [dismissed, resolved]);

  const presenterMessages = useMemo((): AssistantChatMessage[] => {
    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
    }));
  }, [messages]);

  const pending = pendingConfirmationFromMessages(presenterMessages, ignored);
  const card = confirmationCardState({
    pending,
    resolvingChallengeId,
  });
  const rows = assistantChatRows(
    presenterMessages,
    card.kind === "hidden" ? null : card.confirmation,
  );

  const busy = status === "submitted" || status === "streaming";
  const creating = createConversation.isPending;
  const sendBusy = busy || creating;

  const ensureConversation = useCallback(async (): Promise<string> => {
    const existing = conversationIdRef.current;
    if (existing !== null) {
      return existing;
    }
    const created = await createConversation.submit({});
    conversationIdRef.current = created.id;
    return created.id;
  }, [createConversation]);

  const send = useCallback(() => {
    const text = clipAssistantInput(input);
    if (text.length === 0 || sendBusy) {
      return;
    }
    setInput("");
    clearError();
    void (async () => {
      try {
        await ensureConversation();
        await sendMessage({ text });
      } catch {
        setInput(text);
      }
    })();
  }, [clearError, ensureConversation, input, sendBusy, sendMessage]);

  const confirm = useCallback(() => {
    if (pending === null || sendBusy) {
      return;
    }
    setResolvingChallengeId(pending.challengeId);
    void executeConfirmationConfirm({
      pending,
      resume: (headers) => sendMessage(undefined, { headers: { ...headers } }),
    }).catch(() => {
      setResolvingChallengeId(null);
    });
  }, [pending, sendBusy, sendMessage]);

  const dismiss = useCallback(() => {
    setDismissed((previous) =>
      executeConfirmationDismiss({ pending, dismissed: previous }),
    );
  }, [pending]);

  const createKind = createConversation.isError
    ? queryFailureToAssistantKind(
        describeQueryFailure(createConversation.error).kind,
      )
    : null;
  const chatKind = error !== undefined ? assistantChatErrorKind(error) : null;
  const bannerKind = createKind ?? chatKind;
  const banner =
    bannerKind === null ? null : assistantChatErrorMessage(bannerKind, copy);

  return {
    ready: apiClient !== null && activeCompanyId !== null && apiUrl !== null,
    copy,
    rows,
    input,
    changeInput: setInput,
    send,
    confirm,
    dismiss,
    busy: sendBusy,
    thinking: busy,
    confirmationApplying: card.kind === "applying",
    canSend:
      clipAssistantInput(input).length > 0 &&
      !sendBusy &&
      apiClient !== null &&
      activeCompanyId !== null &&
      apiUrl !== null,
    banner,
  };
}
