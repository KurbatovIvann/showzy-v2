import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { apiUrlFromEnv } from "../../../api/config";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useBoundContractMutation } from "../../../api/use-bound-contract-mutation";
import { useAuthSession } from "../../../auth/session-provider";
import { clipAssistantInput } from "../api/assistant-chat-body";
import {
  createStaffAssistantTransport,
  type StaffAssistantUiMessage,
} from "../api/assistant-chat-transport";
import { bindCreateConversationMutate } from "../api/create-conversation";
import {
  ensureAssistantConversation,
  resetAssistantTenantSession,
} from "../shared/assistant-session";
import {
  queryFailureToAssistantKind,
  type AssistantChatErrorKind,
} from "../shared/chat-error";
import type { AssistantChatMessage } from "../shared/confirmation-presenter";
import type { AssistantChatStatus } from "./use-assistant-confirmation";

function resolveApiUrl(): string | null {
  try {
    return apiUrlFromEnv();
  } catch {
    return null;
  }
}

export function useAssistantChat(): {
  readonly ready: boolean;
  readonly messages: readonly AssistantChatMessage[];
  readonly status: AssistantChatStatus;
  readonly error: unknown;
  readonly input: string;
  readonly changeInput: (value: string) => void;
  readonly send: () => void;
  readonly resume: (headers: Readonly<Record<string, string>>) => Promise<void>;
  readonly sendBusy: boolean;
  readonly thinking: boolean;
  readonly canSend: boolean;
  readonly createErrorKind: AssistantChatErrorKind | null;
  readonly confirmationResetRef: {
    current: () => void;
  };
} {
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const apiUrl = useMemo(() => resolveApiUrl(), []);
  const confirmationResetRef = useRef<() => void>(() => {
    return;
  });

  const cookieRef = useRef(auth.getCookie);
  cookieRef.current = auth.getCookie;
  const companyIdRef = useRef(activeCompanyId);
  companyIdRef.current = activeCompanyId;
  const conversationIdRef = useRef<string | null>(null);
  const previousCompanyIdRef = useRef(activeCompanyId);
  const companyEpochRef = useRef(0);

  const [input, setInput] = useState("");

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

  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat<StaffAssistantUiMessage>({
      id: activeCompanyId ?? "assistant-none",
      transport,
    });

  const presenterMessages = useMemo((): AssistantChatMessage[] => {
    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts,
    }));
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const sendBusy = busy || createConversation.isPending;

  const resume = useCallback(
    (headers: Readonly<Record<string, string>>) =>
      sendMessage(undefined, { headers: { ...headers } }),
    [sendMessage],
  );

  useEffect(() => {
    const previous = previousCompanyIdRef.current;
    previousCompanyIdRef.current = activeCompanyId;
    if (previous === activeCompanyId) {
      return;
    }
    companyEpochRef.current += 1;
    const epoch = companyEpochRef.current;
    resetAssistantTenantSession({
      conversationIdRef,
      setMessages,
      resetConfirmation: () => {
        confirmationResetRef.current();
      },
    });
    if (activeCompanyId === null) {
      return;
    }
    void createConversation
      .submit({})
      .then((created) => {
        if (companyEpochRef.current !== epoch) {
          return;
        }
        conversationIdRef.current = created.id;
      })
      .catch(() => undefined);
  }, [activeCompanyId, createConversation, setMessages]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    return ensureAssistantConversation({
      conversationIdRef,
      create: () => createConversation.submit({}),
    });
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

  const createErrorKind = createConversation.isError
    ? queryFailureToAssistantKind(
        describeQueryFailure(createConversation.error).kind,
      )
    : null;

  return {
    ready: apiClient !== null && activeCompanyId !== null && apiUrl !== null,
    messages: presenterMessages,
    status,
    error,
    input,
    changeInput: setInput,
    send,
    resume,
    sendBusy,
    thinking: busy,
    canSend:
      clipAssistantInput(input).length > 0 &&
      !sendBusy &&
      apiClient !== null &&
      activeCompanyId !== null &&
      apiUrl !== null,
    createErrorKind,
    confirmationResetRef,
  };
}
