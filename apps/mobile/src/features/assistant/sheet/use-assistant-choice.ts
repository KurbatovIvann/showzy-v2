import { useCallback, useMemo, useRef, useState } from "react";

import {
  choiceCardState,
  choiceSelectAppendParts,
  choiceSelectShouldIgnoreChallenge,
  executeChoiceSelect,
  pendingChoiceFromMessages,
  type AssistantChoiceMessage,
  type ChoiceAppendPart,
  type ChoiceCardState,
  type ChoiceSelectResult,
  type PendingChoice,
} from "../shared/choice-presenter";

export function useAssistantChoice(args: {
  readonly messages: readonly AssistantChoiceMessage[];
  readonly locale: "uk" | "en";
  readonly postChoice: (input: {
    readonly choiceId: string;
    readonly optionId: string;
  }) => Promise<ChoiceSelectResult>;
  readonly appendParts: (parts: readonly ChoiceAppendPart[]) => void;
}): {
  readonly pending: PendingChoice | null;
  readonly ignoredChallengeIds: ReadonlySet<string>;
  readonly card: ChoiceCardState;
  readonly select: (optionId: string) => void;
  readonly reset: () => void;
} {
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(() => new Set());
  const [resolvingChallengeId, setResolvingChallengeId] = useState<
    string | null
  >(null);
  const ignoredRef = useRef<ReadonlySet<string>>(new Set());
  const resolvingRef = useRef<string | null>(null);

  const clearResolving = useCallback(() => {
    resolvingRef.current = null;
    setResolvingChallengeId(null);
  }, []);

  const pending = pendingChoiceFromMessages(args.messages, ignored);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const card = choiceCardState({
    pending,
    resolvingChallengeId,
  });

  const select = useCallback(
    (optionId: string) => {
      const current = pendingRef.current;
      if (current === null || resolvingRef.current !== null) {
        return;
      }
      setResolvingChallengeId(current.challengeId);
      void executeChoiceSelect({
        pending: current,
        optionId,
        resolvingRef,
        postChoice: args.postChoice,
      })
        .then((result) => {
          if (result === "skipped") {
            clearResolving();
            return;
          }
          if (choiceSelectShouldIgnoreChallenge(result)) {
            const next = new Set(ignoredRef.current);
            next.add(current.challengeId);
            ignoredRef.current = next;
            setIgnored(next);
          }
          const parts = choiceSelectAppendParts({
            result,
            previousChoiceId: current.challengeId,
            locale: args.locale,
          });
          if (parts.length > 0) {
            args.appendParts(parts);
          }
          clearResolving();
        })
        .catch(() => {
          clearResolving();
        });
    },
    [args.appendParts, args.locale, args.postChoice, clearResolving],
  );

  const reset = useCallback(() => {
    const empty = new Set<string>();
    ignoredRef.current = empty;
    pendingRef.current = null;
    resolvingRef.current = null;
    setIgnored(empty);
    setResolvingChallengeId(null);
  }, []);

  const ignoredChallengeIds = useMemo(() => ignored, [ignored]);

  return {
    pending,
    ignoredChallengeIds,
    card,
    select,
    reset,
  };
}
