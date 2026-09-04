import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import { OrderLineCard } from "./order-line-card";

const copy = ordersCopy("uk");

afterEach(cleanup);

describe("OrderLineCard", () => {
  it("renders the canvas danger delete chip and a typed qty field", () => {
    render(
      <ul>
        <OrderLineCard
          productName="Капкейк"
          variantName={null}
          quantityLabel="1"
          editable
          thumbnailFileId={null}
          thumbnailUrl={null}
          thumbnailFailed={false}
          copy={copy.create}
          onCommitUnits={() => undefined}
          onRemove={() => undefined}
        />
      </ul>,
    );
    const remove = screen.getByRole("button", { name: "Видалити Капкейк" });
    expect(remove.className).toContain("bg-dangerSoft");
    expect(remove.className).toContain("text-danger");
    expect(remove.textContent).toContain("Видалити");
    const qty = screen.getByRole("textbox", {
      name: "Кількість для Капкейк",
    });
    expect(qty).toHaveProperty("value", "1");
    expect(qty.closest("div")?.className).toContain("bg-surface");
    expect(qty.closest("div")?.className).toContain("border-line");
  });
});
