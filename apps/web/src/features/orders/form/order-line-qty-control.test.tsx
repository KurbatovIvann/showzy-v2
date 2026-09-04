import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderLineQtyControl } from "./order-line-qty-control";

afterEach(cleanup);

describe("OrderLineQtyControl", () => {
  it("commits typed units and clamps empty blur back to one", () => {
    const onCommitUnits = vi.fn();
    render(
      <OrderLineQtyControl
        quantityLabel="1"
        editable
        inputLabel="Quantity for Cake"
        decreaseLabel="Decrease"
        increaseLabel="Increase"
        onCommitUnits={onCommitUnits}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Quantity for Cake" });
    fireEvent.change(input, { target: { value: "4" } });
    expect(onCommitUnits).toHaveBeenCalledWith(4);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onCommitUnits).toHaveBeenLastCalledWith(1);
  });

  it("steps from the typed value while the field is focused", () => {
    const onCommitUnits = vi.fn();
    render(
      <OrderLineQtyControl
        quantityLabel="1"
        editable
        inputLabel="Quantity for Cake"
        decreaseLabel="Decrease"
        increaseLabel="Increase"
        onCommitUnits={onCommitUnits}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Quantity for Cake" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(onCommitUnits).toHaveBeenLastCalledWith(4);
  });
});
