import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./price-list-form.schema";
import {
  entryMessagesFromRhfRows,
  fieldErrorsFromFormState,
  mapPriceListFormFailure,
  rhfPathsForFieldErrors,
} from "./price-list-form-copy";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("price-list form copy mapping", () => {
  it("maps planner field errors onto RHF paths", () => {
    expect(
      rhfPathsForFieldErrors(
        { name: "too_long", entries: { [PRODUCT_ID]: "invalid" } },
        [{ key: PRODUCT_ID }],
      ),
    ).toEqual([
      { name: "name", message: "too_long" },
      { name: "entries.0.priceText", message: "invalid" },
    ]);
  });

  it("prefers submitted RHF messages then server issues", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: "required",
        entryMessages: { [PRODUCT_ID]: "invalid" },
        server: emptyFieldErrors(),
      }),
    ).toEqual({
      name: "required",
      entries: { [PRODUCT_ID]: "invalid" },
    });
    expect(mapPriceListFormFailure("permission")).toBe("permission");
    expect(mapPriceListFormFailure("offline")).toBe("offline");
  });

  it("maps RHF entry messages by draft key", () => {
    expect(
      entryMessagesFromRhfRows([{ key: PRODUCT_ID }], [
        { priceText: { message: "invalid" } },
      ]),
    ).toEqual({ [PRODUCT_ID]: "invalid" });
  });
});
