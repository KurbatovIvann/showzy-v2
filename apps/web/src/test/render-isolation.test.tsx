/**
 * Sequential `renderApp` isolation (SHO-332). Long URL tables live as
 * `it.each` so each remount gets a fresh 15s budget. This pin keeps a
 * short panel remount then `/onboarding` so leftover `.panel-shell`
 * still fails the suite.
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
  it("remounts a panel URL then onboarding without leftover chrome", async () => {
    signInWithFlowers();
    const panel = await renderApp("/kviti-lviv");
    await waitFor(() => {
      expect(document.querySelector(".panel-shell")).not.toBeNull();
    });
    expect(
      await screen.findByRole("region", { name: "Замовлення" }),
    ).toBeDefined();
    expect(panel.router.state.location.pathname).toBe("/kviti-lviv");

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
