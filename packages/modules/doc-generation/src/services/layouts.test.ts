import { describe, expect, it } from "vitest";

import { ValidationError } from "@showzy/core/errors";

import {
  DOCUMENT_LAYOUTS,
  LAYOUT_TYPE_MISMATCH_MESSAGE,
  UNKNOWN_LAYOUT_KEY_MESSAGE,
  canonicalizeLayoutKey,
  listDocumentLayouts,
  resolveDocumentLayout,
} from "./layouts.js";

describe("document layout catalog", () => {
  it("declares one key per type, both marked default", () => {
    expect(DOCUMENT_LAYOUTS.map((row) => row.key)).toEqual([
      "payment_invoice.branded",
      "delivery_note.parties",
    ]);
    expect(
      DOCUMENT_LAYOUTS.filter((row) => row.type === "payment_invoice").map(
        (row) => [row.key, row.isDefault],
      ),
    ).toEqual([["payment_invoice.branded", true]]);
    expect(
      DOCUMENT_LAYOUTS.filter((row) => row.type === "delivery_note").map(
        (row) => [row.key, row.isDefault],
      ),
    ).toEqual([["delivery_note.parties", true]]);
  });

  it("maps legacy template_name aliases to the type default", () => {
    expect(canonicalizeLayoutKey("payment_invoice")).toBe(
      "payment_invoice.branded",
    );
    expect(canonicalizeLayoutKey("delivery_note")).toBe(
      "delivery_note.parties",
    );
    expect(canonicalizeLayoutKey("payment_invoice.branded")).toBe(
      "payment_invoice.branded",
    );
    expect(canonicalizeLayoutKey("payment_invoice.plain")).toBeNull();
    expect(canonicalizeLayoutKey("delivery_note.plain")).toBeNull();
    expect(canonicalizeLayoutKey("unknown")).toBeNull();
  });

  it("filters the static catalog by type", () => {
    expect(listDocumentLayouts().map((row) => row.key)).toHaveLength(2);
    expect(
      listDocumentLayouts("payment_invoice").map((row) => row.key),
    ).toEqual(["payment_invoice.branded"]);
  });

  it("resolves aliases to canonical keys and rejects unknown or mismatched keys", () => {
    expect(
      resolveDocumentLayout({
        layoutKey: "delivery_note.parties",
        type: "delivery_note",
      }),
    ).toEqual({ key: "delivery_note.parties", type: "delivery_note" });
    expect(
      resolveDocumentLayout({
        layoutKey: "delivery_note",
        type: "delivery_note",
      }),
    ).toEqual({ key: "delivery_note.parties", type: "delivery_note" });

    try {
      resolveDocumentLayout({
        layoutKey: "act.plain",
        type: "payment_invoice",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).clientMessage).toBe(
        UNKNOWN_LAYOUT_KEY_MESSAGE,
      );
    }

    try {
      resolveDocumentLayout({
        layoutKey: "delivery_note.parties",
        type: "payment_invoice",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).clientMessage).toBe(
        LAYOUT_TYPE_MISMATCH_MESSAGE,
      );
    }
  });
});
