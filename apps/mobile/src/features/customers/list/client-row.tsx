import { memo } from "react";
import { Text } from "react-native";
import { MailIcon, PhoneIcon, TagIcon } from "lucide-react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button, StatusPill } from "../../../components/ui";
import { customerInitials } from "../shared/initials";
import { EntityAvatar, EntityCard } from "../shared/entity-card";
import { EntityMetaLine } from "../shared/entity-meta-line";
import { clientRowActions } from "./clients-list.presenter";

export const ClientRow = memo(function ClientRow(props: {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly archivedLabel: string;
  readonly groupName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly priceListName: string | null;
  readonly counterpartiesLabel: string | null;
  readonly editLabel: string;
  readonly restoreLabel: string;
  readonly archiveA11y: string;
  readonly deleteA11y: string;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly disabled: boolean;
  readonly onEdit: (id: string) => void;
  readonly onArchive: (id: string) => void;
  readonly onRestore: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  const actions = clientRowActions({
    archived: props.archived,
    canEdit: props.canEdit,
    canDelete: props.canDelete,
  });
  const iconColor = theme.colors.icon.muted;
  const iconSize = theme.iconSize.sm;

  return (
    <EntityCard
      title={props.name}
      avatar={
        <EntityAvatar>
          <Text style={styles.initials}>{customerInitials(props.name)}</Text>
        </EntityAvatar>
      }
      badges={
        <>
          {props.groupName !== null ? (
            <StatusPill label={props.groupName} />
          ) : null}
          {props.archived ? (
            <StatusPill label={props.archivedLabel} tone="attention" />
          ) : null}
          {props.counterpartiesLabel !== null ? (
            <StatusPill label={props.counterpartiesLabel} tone="action" />
          ) : null}
        </>
      }
      meta={
        <>
          {props.phone !== null ? (
            <EntityMetaLine
              icon={<PhoneIcon size={iconSize} color={iconColor} />}
            >
              {props.phone}
            </EntityMetaLine>
          ) : null}
          {props.email !== null ? (
            <EntityMetaLine
              icon={<MailIcon size={iconSize} color={iconColor} />}
            >
              {props.email}
            </EntityMetaLine>
          ) : null}
          {props.priceListName !== null ? (
            <EntityMetaLine
              icon={<TagIcon size={iconSize} color={iconColor} />}
            >
              {props.priceListName}
            </EntityMetaLine>
          ) : null}
        </>
      }
      editLabel={props.editLabel}
      showEdit={actions.showEdit}
      onEdit={() => {
        props.onEdit(props.id);
      }}
      removeLabel={actions.showDelete ? props.deleteA11y : props.archiveA11y}
      removeMode={actions.showDelete ? "delete" : "archive"}
      showRemove={actions.showArchive || actions.showDelete}
      onRemove={() => {
        if (actions.showDelete) {
          props.onRemove(props.id);
          return;
        }
        props.onArchive(props.id);
      }}
      extra={
        actions.showRestore ? (
          <Button
            variant="secondary"
            disabled={props.disabled}
            label={props.restoreLabel}
            onPress={() => {
              props.onRestore(props.id);
            }}
          />
        ) : undefined
      }
      disabled={props.disabled}
    />
  );
});

const styles = StyleSheet.create((theme) => ({
  initials: {
    color: theme.colors.foreground,
    // Class B: canvas 14 → typography.sm.
    fontSize: theme.typography.sm.fontSize,
    lineHeight: theme.typography.sm.lineHeight,
    fontWeight: "600",
  },
}));
