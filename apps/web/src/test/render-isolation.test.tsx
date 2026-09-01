/**
 * Sequential `renderApp` isolation (SHO-332). CI leftover router/jsdom
 * left an empty `<div />` or a mounted `.panel-shell` on the next
 * remount — including `/onboarding` after a hung section table.
 */
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FLOWERS_MEMBERSHIP, signedInOwner } from "./company-fixtures";
import { listMineState, sessionState } from "./msw";
import { renderApp } from "./render";

afterEach(cleanup);

function signInWithFlowers(): void {
  sessionState.user = signedInOwner();
  listMineState.memberships = [FLOWERS_MEMBERSHIP];
}

describe("renderApp isolation (SHO-332)", () => {
  it("remounts a panel URL table then onboarding without leftover chrome", async () => {
    signInWithFlowers();
    const cases: ReadonlyArray<{
      readonly path: string;
      readonly region: string;
    }> = [
      { path: "/kviti-lviv", region: "Замовлення" },
      { path: "/kviti-lviv/documents/doc-1", region: "Документи" },
      { path: "/kviti-lviv/customers/c-1", region: "Клієнти" },
      { path: "/kviti-lviv/products/prod-1/edit", region: "Товари" },
    ];
    for (const item of cases) {
      const { router } = await renderApp(item.path);
      await waitFor(() => {
        expect(document.querySelector(".panel-shell")).not.toBeNull();
      });
      expect(
        await screen.findByRole("region", { name: item.region }),
      ).toBeDefined();
      expect(router.state.location.pathname).toBe(item.path);
    }

    listMineState.memberships = [];
    const { router } = await renderApp("/onboarding");
    expect(
      await screen.findByRole("heading", { name: "Про ваш бізнес" }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe("/onboarding");
    expect(document.querySelector(".panel-shell")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Основна навігація" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Замовлення" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Документи" })).toBeNull();
  });
});
