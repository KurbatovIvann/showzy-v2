import { memo } from "react";
import { BuildingIcon, UserIcon } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../../components/ui";
import { EntityAvatar, EntityCard } from "../shared/entity-card";
import { EntityMetaLine } from "../shared/entity-meta-line";
import { counterpartyRowActions } from "./counterparties-list.presenter";

export const CounterpartyRow = memo(function CounterpartyRow(props: {
  readonly id: string;
  readonly name: string;
  readonly edrpouLabel: string | null;
  readonly customerName: string | null;
  readonly editLabel: string;
  readonly deleteA11y: string;
  readonly canEdit: boolean;
  readonly disabled: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  const actions = counterpartyRowActions(props.canEdit);
  const iconColor = theme.colors.icon.muted;
  const iconSize = theme.iconSize.sm;

  return (
    <EntityCard
      title={props.name}
      avatar={
        <EntityAvatar>
          <BuildingIcon size={iconSize} color={theme.colors.foreground} />
        </EntityAvatar>
      }
      badges={
        props.edrpouLabel !== null ? (
          <StatusPill label={props.edrpouLabel} />
        ) : undefined
      }
      meta={
        props.customerName !== null ? (
          <EntityMetaLine icon={<UserIcon size={iconSize} color={iconColor} />}>
            {props.customerName}
          </EntityMetaLine>
        ) : undefined
      }
      editLabel={props.editLabel}
      showEdit={actions.showEdit}
      onEdit={() => {
        props.onEdit(props.id);
      }}
      removeLabel={props.deleteA11y}
      removeMode="delete"
      showRemove={actions.showDelete}
      onRemove={() => {
        props.onRemove(props.id);
      }}
      disabled={props.disabled}
    />
  );
});
