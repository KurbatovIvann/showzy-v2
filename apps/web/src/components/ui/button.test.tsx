/**
 * Button primitive (SHO-311): canvas variants, disabled state, and the
 * focus-visible ring on the `action` token
 * (`web-panel-chrome.md` §Visual language).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, buttonClassName } from "./button";

afterEach(cleanup);

function classesOf(name: string): string {
  return screen.getByRole("button", { name }).className;
}

describe("Button (SHO-311)", () => {
  it("renders the primary variant as an ink pill by default", () => {
    render(<Button>Зберегти</Button>);
    const classes = classesOf("Зберегти");
    expect(classes).toContain("bg-ink");
    expect(classes).toContain("text-white");
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("font-semibold");
  });

  it("renders the secondary variant with the hairline border", () => {
    render(<Button variant="secondary">Скасувати</Button>);
    const classes = classesOf("Скасувати");
    expect(classes).toContain("border-line");
    expect(classes).toContain("text-ink");
    expect(classes).not.toContain("bg-ink");
  });

  it("renders the danger variant on the danger token", () => {
    render(<Button variant="danger">Видалити</Button>);
    expect(classesOf("Видалити")).toContain("bg-danger");
  });

  it("applies the canvas size steps", () => {
    render(
      <>
        <Button size="compact">Компактний</Button>
        <Button size="sm">Малий</Button>
        <Button>Середній</Button>
        <Button size="lg">Великий</Button>
      </>,
    );
    expect(classesOf("Компактний")).toContain("text-[13px]");
    expect(classesOf("Малий")).toContain("text-[14px]");
    expect(classesOf("Середній")).toContain("text-[15px]");
    expect(classesOf("Великий")).toContain("text-[17px]");
  });

  it("exposes the same classes for a Link-shaped create control", () => {
    const classes = buttonClassName({ size: "compact" });
    expect(classes).toContain("bg-ink");
    expect(classes).toContain("text-white");
    expect(classes).toContain("text-[13px]");
    expect(classes).not.toContain("text-action");
  });

  it("carries the focus-visible ring on the action token", () => {
    render(<Button>Продовжити</Button>);
    const classes = classesOf("Продовжити");
    expect(classes).toContain("focus-visible:ring-2");
    expect(classes).toContain("focus-visible:ring-action");
  });

  it("dims when disabled and does not fire clicks", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Створити
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Створити" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.className).toContain("disabled:opacity-40");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so forms are not submitted implicitly", () => {
    render(<Button>Дія</Button>);
    const button = screen.getByRole("button", { name: "Дія" });
    expect(button.getAttribute("type")).toBe("button");
  });

  it("merges caller classes (canvas layouts pass w-full/flex-1)", () => {
    render(<Button className="w-full">На всю ширину</Button>);
    expect(classesOf("На всю ширину")).toContain("w-full");
  });
});
