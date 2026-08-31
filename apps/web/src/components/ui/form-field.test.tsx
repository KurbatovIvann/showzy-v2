/**
 * Form field wrappers (SHO-311): label association, validation error vs
 * hint, and the focus-visible ring on the `action` token
 * (`web-panel-chrome.md` §Visual language).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InputField, TextareaField } from "./form-field";

afterEach(cleanup);

function renderInput(overrides?: {
  readonly error?: string | null;
  readonly hint?: string;
  readonly onChange?: (value: string) => void;
}) {
  render(
    <InputField
      id="client-name"
      label="Ім’я"
      value=""
      onChange={overrides?.onChange ?? (() => undefined)}
      error={overrides?.error}
      hint={overrides?.hint}
    />,
  );
  return screen.getByLabelText("Ім’я");
}

describe("InputField (SHO-311)", () => {
  it("associates the label and reports changes as plain values", () => {
    const onChange = vi.fn();
    const input = renderInput({ onChange });
    fireEvent.change(input, { target: { value: "Марія" } });
    expect(onChange).toHaveBeenCalledWith("Марія");
  });

  it("styles the control on canvas tokens with the action focus ring", () => {
    const input = renderInput();
    expect(input.className).toContain("bg-canvas");
    expect(input.className).toContain("rounded-card");
    expect(input.className).toContain("border-line");
    expect(input.className).toContain("focus-visible:ring-2");
    expect(input.className).toContain("focus-visible:ring-action");
  });

  it("switches to the danger border and message on error", () => {
    const input = renderInput({
      error: "Вкажіть ім’я клієнта",
      hint: "Підказка",
    });
    expect(input.className).toContain("border-danger");
    expect(input.className).not.toContain("border-line");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Вкажіть ім’я клієнта").className).toContain(
      "text-danger",
    );
    // The hint yields to the error message.
    expect(screen.queryByText("Підказка")).toBeNull();
  });

  it("shows the faint hint when there is no error", () => {
    renderInput({ hint: "Потрібен хоча б один контакт" });
    expect(
      screen.getByText("Потрібен хоча б один контакт").className,
    ).toContain("text-faint");
  });
});

describe("TextareaField (SHO-311)", () => {
  it("renders a labeled textarea on the same control chrome", () => {
    const onChange = vi.fn();
    render(
      <TextareaField
        id="client-notes"
        label="Нотатки"
        value=""
        onChange={onChange}
      />,
    );
    const textarea = screen.getByLabelText("Нотатки");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.className).toContain("bg-canvas");
    expect(textarea.className).toContain("focus-visible:ring-action");
    fireEvent.change(textarea, { target: { value: "Доставка щоп’ятниці" } });
    expect(onChange).toHaveBeenCalledWith("Доставка щоп’ятниці");
  });
});
