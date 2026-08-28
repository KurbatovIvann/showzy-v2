import { View } from "react-native";
import { BuildingIcon, MailIcon, PlusIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  ChoiceField,
  EmptyState,
  IconButton,
  SearchField,
} from "../../../components/ui";
import { GroupsListPane } from "../groups/groups-list-pane";
import { ClientsListPane } from "./clients-list-pane";
import { CustomersTabs } from "./customers-tabs";
import type { CustomersHomeModel } from "./use-customers-home";

export function CustomersHomeView(model: CustomersHomeModel) {
  const { theme } = useUnistyles();
  const { copy } = model;

  return (
    <SafeAreaView
      edges={["top"]}
      accessibilityLabel={copy.title}
      style={styles.screen}
    >
      {/* Named deviation: omit canvas subtitle "N активних" (no activeCount). */}
      <AppHeader
        title={copy.title}
        actions={
          model.canCreate ? (
            <IconButton
              icon={
                <PlusIcon
                  size={theme.iconSize.md}
                  color={theme.colors.primaryForeground}
                />
              }
              accessibilityLabel={model.createLabel}
              onPress={model.openCreate}
            />
          ) : undefined
        }
      />
      {model.banner !== null ? (
        <View style={styles.banner}>
          <Banner message={model.banner} />
        </View>
      ) : null}
      <View style={styles.controls}>
        <CustomersTabs
          labels={copy.tabs}
          selected={model.tab}
          onSelect={model.selectTab}
        />
        {model.tab === "clients" ? (
          <>
            <SearchField
              value={model.clients.searchText}
              onChangeText={model.clients.changeSearch}
              placeholder={copy.clientsSearchPlaceholder}
              accessibilityLabel={copy.searchLabel}
              maxLength={model.clients.searchMaxLength}
            />
            <ChoiceField
              options={model.clients.chipOptions}
              selected={model.clients.chipKey}
              onSelect={model.clients.changeChip}
            />
          </>
        ) : null}
        {model.tab === "groups" ? (
          <SearchField
            value={model.groups.searchText}
            onChangeText={model.groups.changeSearch}
            placeholder={copy.groupsSearchPlaceholder}
            accessibilityLabel={copy.searchLabel}
            maxLength={model.groups.searchMaxLength}
          />
        ) : null}
      </View>
      <CustomersHomeBody model={model} />
    </SafeAreaView>
  );
}

function CustomersHomeBody(props: { readonly model: CustomersHomeModel }) {
  const { model } = props;
  const { copy } = model;
  const { theme } = useUnistyles();
  const iconColor = theme.colors.mutedForeground;

  if (model.tab === "clients") {
    return (
      <ClientsListPane model={model.clients} openCreate={model.openCreate} />
    );
  }
  if (model.tab === "groups") {
    return (
      <GroupsListPane model={model.groups} openCreate={model.openCreate} />
    );
  }
  if (model.tab === "counterparties") {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<BuildingIcon size={theme.iconSize.md} color={iconColor} />}
          title={copy.comingSoon.counterpartiesTitle}
          description={copy.comingSoon.counterpartiesDescription}
        />
      </View>
    );
  }
  return (
    <View style={styles.centered}>
      <EmptyState
        icon={<MailIcon size={theme.iconSize.md} color={iconColor} />}
        title={copy.comingSoon.invitationsTitle}
        description={copy.comingSoon.invitationsDescription}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  banner: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  controls: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
  },
}));
