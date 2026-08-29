import { memo } from "react";
import {
  CalendarIcon,
  MailIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";

import { StatusPill } from "../../../components/ui";
import { EntityAvatar, EntityCard } from "../shared/entity-card";
import { EntityMetaLine } from "../shared/entity-meta-line";
import type { InviteStatusTone } from "./invitations-list.presenter";

export const InvitationRow = memo(function InvitationRow(props: {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly statusTone: InviteStatusTone;
  readonly groupName: string | null;
  readonly priceListName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly usesLabel: string;
  readonly expiryLabel: string;
  readonly revokeA11y: string;
  readonly showRevoke: boolean;
  readonly disabled: boolean;
  readonly onRevoke: (id: string) => void;
}) {
  const { theme } = useUnistyles();
  const iconColor = theme.colors.icon.muted;
  const iconSize = theme.iconSize.sm;

  return (
    <EntityCard
      title={props.title}
      avatar={
        <EntityAvatar>
          <UsersIcon size={iconSize} color={theme.colors.foreground} />
        </EntityAvatar>
      }
      badges={
        <>
          <StatusPill label={props.statusLabel} tone={props.statusTone} />
          {props.groupName !== null ? (
            <StatusPill label={props.groupName} />
          ) : null}
          {props.priceListName !== null ? (
            <StatusPill label={props.priceListName} tone="action" />
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
          <EntityMetaLine
            icon={<UsersIcon size={iconSize} color={iconColor} />}
          >
            {props.usesLabel}
          </EntityMetaLine>
          <EntityMetaLine
            icon={<CalendarIcon size={iconSize} color={iconColor} />}
          >
            {props.expiryLabel}
          </EntityMetaLine>
        </>
      }
      editLabel=""
      showEdit={false}
      onEdit={() => undefined}
      removeLabel={props.revokeA11y}
      removeMode="delete"
      showRemove={props.showRevoke}
      onRemove={() => {
        props.onRevoke(props.id);
      }}
      disabled={props.disabled}
    />
  );
});
