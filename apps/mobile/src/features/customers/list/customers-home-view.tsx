import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { PlusIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import {
  AppHeader,
  Banner,
  ChoiceField,
  IconButton,
  indexOfTabKey,
  SearchField,
  SegmentedTabs,
  TabView,
  type TabBarProps,
} from "../../../components/ui";
import { CounterpartiesListPane } from "../counterparties/counterparties-list-pane";
import { GroupsListPane } from "../groups/groups-list-pane";
import { InvitationsListPane } from "../invitations/invitations-list-pane";
import { ClientsListPane } from "./clients-list-pane";
import {
  customersTabOptions,
  type CustomersTab,
} from "./customers-home.presenter";
import type { CustomersHomeModel } from "./use-customers-home";

export function CustomersHomeView(model: CustomersHomeModel) {
  const { theme } = useUnistyles();
  const { copy } = model;
  const tabs = useMemo(() => customersTabOptions(copy.tabs), [copy.tabs]);

  const onTabChange = useCallback(
    (_index: number, key: CustomersTab) => {
      model.selectTab(key);
    },
    [model.selectTab],
  );

  const renderTabBar = useCallback(
    (bar: TabBarProps<CustomersTab>) => <CustomersTabBar {...bar} />,
    [],
  );

  const renderScene = useCallback(
    (key: CustomersTab) => <CustomersHomeScene tab={key} model={model} />,
    [model],
  );

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
      <TabView
        tabs={tabs}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onTabChange={onTabChange}
        lazy
        swipeEnabled
        scrollableTabs
      />
    </SafeAreaView>
  );
}

function CustomersTabBar(props: TabBarProps<CustomersTab>) {
  const { theme } = useUnistyles();
  const selected = props.tabs[props.selectedIndex];
  if (selected === undefined) {
    return null;
  }
  return (
    <View style={styles.tabBar}>
      {/* Canvas CustomersScreen tabs — not the staff BottomNav. */}
      <SegmentedTabs
        layout="scroll"
        contentPaddingHorizontal={theme.spacing.lg}
        tabs={props.tabs}
        selected={selected.key}
        onSelect={(key) => {
          const index = indexOfTabKey(props.tabs, key);
          if (index >= 0) {
            props.onTabPress(index);
          }
        }}
      />
    </View>
  );
}

function CustomersHomeScene(props: {
  readonly tab: CustomersTab;
  readonly model: CustomersHomeModel;
}) {
  const { tab, model } = props;
  const { copy } = model;

  if (tab === "clients") {
    return (
      <View style={styles.scene}>
        <View style={styles.filters}>
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
        </View>
        <ClientsListPane model={model.clients} openCreate={model.openCreate} />
      </View>
    );
  }
  if (tab === "groups") {
    return (
      <View style={styles.scene}>
        <View style={styles.filters}>
          <SearchField
            value={model.groups.searchText}
            onChangeText={model.groups.changeSearch}
            placeholder={copy.groupsSearchPlaceholder}
            accessibilityLabel={copy.searchLabel}
            maxLength={model.groups.searchMaxLength}
          />
        </View>
        <GroupsListPane model={model.groups} openCreate={model.openCreate} />
      </View>
    );
  }
  if (tab === "counterparties") {
    return (
      <View style={styles.scene}>
        <View style={styles.filters}>
          <SearchField
            value={model.counterparties.searchText}
            onChangeText={model.counterparties.changeSearch}
            placeholder={copy.counterpartiesSearchPlaceholder}
            accessibilityLabel={copy.searchLabel}
            maxLength={model.counterparties.searchMaxLength}
          />
        </View>
        <CounterpartiesListPane
          model={model.counterparties}
          openCreate={model.openCreate}
        />
      </View>
    );
  }
  return (
    <View style={styles.scene}>
      <InvitationsListPane
        model={model.invitations}
        openCreate={model.openCreate}
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
  tabBar: {
    paddingBottom: theme.spacing.md,
  },
  scene: {
    flex: 1,
  },
  filters: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
}));
