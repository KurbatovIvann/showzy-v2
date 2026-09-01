/**
 * PaneHeader (SHO-314): hamburger and back visibility are explicit flags
 * from shell-width mode.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaneHeader } from "./pane-header";

afterEach(cleanup);

describe("PaneHeader (SHO-314)", () => {
  it("renders the title and omits menu/back when flags are off", () => {
    render(
      <PaneHeader
        title="Замовлення"
        menuLabel="Меню"
        backLabel="Назад до списку"
        onOpenNav={() => undefined}
        showMenu={false}
        showBack={false}
      />,
    );
    expect(screen.getByText("Замовлення")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Меню" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Назад до списку" }),
    ).toBeNull();
  });

  it("fires open-nav and back when those controls are shown", () => {
    const onOpenNav = vi.fn();
    const onBack = vi.fn();
    render(
      <PaneHeader
        title="Товари"
        menuLabel="Меню"
        backLabel="Назад до списку"
        onOpenNav={onOpenNav}
        onBack={onBack}
        showMenu
        showBack
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад до списку" }));
    expect(onOpenNav).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
