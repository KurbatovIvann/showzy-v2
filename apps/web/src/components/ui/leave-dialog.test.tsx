/**
 * LeaveDialog (SHO-379): stay / leave / Escape stays. Copy is props —
 * no domain strings in the primitive.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaveDialog } from "./leave-dialog";

afterEach(cleanup);

describe("LeaveDialog (SHO-379)", () => {
  it("does not render when closed", () => {
    render(
      <LeaveDialog
        open={false}
        title="Leave without saving?"
        stayLabel="Keep editing"
        leaveLabel="Leave without saving"
        onStay={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays on Escape and the stay action; leave fires only the leave action", () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(
      <LeaveDialog
        open
        title="Вийти без збереження?"
        description="Внесені зміни буде втрачено."
        stayLabel="Продовжити редагування"
        leaveLabel="Вийти без збереження"
        onStay={onStay}
        onLeave={onLeave}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Вийти без збереження?" }),
    ).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole("button", { name: "Продовжити редагування" }),
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Продовжити редагування" }),
    );
    expect(onStay).toHaveBeenCalledTimes(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Вийти без збереження" }),
    );
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
