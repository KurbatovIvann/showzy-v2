import { useCallback, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItem,
} from "@shopify/flash-list";
import { SparklesIcon, WifiOffIcon } from "lucide-react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { AppHeader, Banner, EmptyState } from "../../../components/ui";
import type { AssistantCopy } from "../../../i18n/assistant";
import {
  assistantRowHasInFlightTools,
  type AssistantChatRow,
} from "../shared/chat-rows";
import { AssistantComposer } from "./assistant-composer";
import { AssistantMessageRow } from "./assistant-message-row";

export type AssistantSheetViewModel = {
  readonly copy: AssistantCopy;
  readonly rows: readonly AssistantChatRow[];
  readonly input: string;
  readonly changeInput: (value: string) => void;
  readonly send: () => void;
  readonly confirm: () => void;
  readonly dismiss: () => void;
  readonly busy: boolean;
  readonly thinking: boolean;
  readonly confirmationApplying: boolean;
  readonly canSend: boolean;
  readonly banner: string | null;
};

function keyExtractor(item: AssistantChatRow): string {
  return item.id;
}

function itemType(item: AssistantChatRow): string {
  if (item.role === "user") {
    return "user";
  }
  if (item.timeline.length > 0) {
    return "assistant-timeline";
  }
  if (item.confirmation !== null) {
    return "assistant-confirm";
  }
  return "assistant";
}

export function AssistantSheetView(model: AssistantSheetViewModel) {
  const { theme } = useUnistyles();
  const { copy } = model;
  const listRef = useRef<FlashListRef<AssistantChatRow>>(null);

  const renderItem: ListRenderItem<AssistantChatRow> = useCallback(
    ({ item }) => (
      <AssistantMessageRow
        role={item.role}
        text={item.text}
        timeline={item.timeline}
        timelineLabel={copy.timelineLabel}
        confirmationSummary={
          item.confirmation === null ? null : item.confirmation.summary
        }
        confirmationTitle={copy.confirmationTitle}
        confirmLabel={copy.confirmLabel}
        dismissLabel={copy.dismissLabel}
        confirmingLabel={copy.confirmingLabel}
        confirmationApplying={model.confirmationApplying}
        onConfirm={model.confirm}
        onDismiss={model.dismiss}
      />
    ),
    [
      copy.confirmLabel,
      copy.confirmationTitle,
      copy.confirmingLabel,
      copy.dismissLabel,
      copy.timelineLabel,
      model.confirm,
      model.confirmationApplying,
      model.dismiss,
    ],
  );

  const showEmpty = model.rows.length === 0 && !model.thinking;
  const lastRow = model.rows[model.rows.length - 1];
  const showThinking =
    model.thinking &&
    (lastRow === undefined || !assistantRowHasInFlightTools(lastRow));

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.sheetTitle}
      style={styles.screen}
    >
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <AppHeader title={copy.sheetTitle} />
        {model.banner !== null ? (
          <View style={styles.banner}>
            <Banner message={model.banner} />
          </View>
        ) : null}
        {showEmpty ? (
          <View style={styles.unavailable}>
            <EmptyState
              icon={
                <SparklesIcon
                  size={theme.iconSize.md}
                  color={theme.colors.accent}
                />
              }
              title={copy.emptyTitle}
              description={copy.emptyDescription}
            />
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={model.rows}
            style={styles.list}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            getItemType={itemType}
            ListFooterComponent={
              showThinking ? (
                <View
                  accessibilityLabel={copy.thinkingLabel}
                  style={styles.thinking}
                >
                  <ActivityIndicator
                    color={theme.colors.activityIndicator.onBackground}
                  />
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => {
              listRef.current?.scrollToEnd({ animated: true });
            }}
          />
        )}
        <View style={styles.composer}>
          <AssistantComposer
            value={model.input}
            onChangeText={model.changeInput}
            onSend={model.send}
            placeholder={copy.inputPlaceholder}
            accessibilityLabel={copy.inputLabel}
            sendLabel={copy.sendLabel}
            editable={!model.busy}
            canSend={model.canSend}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AssistantUnavailableView(props: {
  readonly title: string;
  readonly description: string;
}) {
  const { theme } = useUnistyles();
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.unavailable}>
        <EmptyState
          icon={
            <WifiOffIcon
              size={theme.iconSize.md}
              color={theme.colors.mutedForeground}
            />
          }
          title={props.title}
          description={props.description}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: theme.spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  thinking: {
    alignItems: "flex-start",
    paddingVertical: theme.spacing.sm,
  },
  composer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  unavailable: {
    flex: 1,
    justifyContent: "center",
  },
}));
