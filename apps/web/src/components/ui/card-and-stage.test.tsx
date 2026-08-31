/**
 * Card and DetailStage wrappers (SHO-311): the surface card chrome and the
 * centered detail-card stage from the canvas.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card } from "./card";
import { DetailStage } from "./detail-stage";

afterEach(cleanup);

describe("Card (SHO-311)", () => {
  it("wraps children in the canvas card chrome", () => {
    render(
      <Card data-testid="card" className="p-4">
        <p>Вміст</p>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-card");
    expect(card.className).toContain("border-line");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("shadow-card");
    expect(card.className).toContain("p-4");
    expect(screen.getByText("Вміст")).toBeDefined();
  });
});

describe("DetailStage (SHO-311)", () => {
  it("renders a labeled stage with children inside the detail card", () => {
    render(
      <DetailStage label="Замовлення #TM-K7K3K4">
        <p>Деталі замовлення</p>
      </DetailStage>,
    );
    const stage = screen.getByRole("region", { name: "Замовлення #TM-K7K3K4" });
    const child = screen.getByText("Деталі замовлення");
    const card = child.closest(".detail-card");
    expect(card).not.toBeNull();
    expect(stage.contains(card)).toBe(true);
  });

  it("replaces the card content with the overlay when provided", () => {
    render(
      <DetailStage label="Стан" overlay={<p>Оберіть елемент</p>}>
        <p>Основний вміст</p>
      </DetailStage>,
    );
    expect(screen.getByText("Оберіть елемент")).toBeDefined();
    expect(screen.queryByText("Основний вміст")).toBeNull();
  });
});
