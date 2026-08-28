import { describe, expect, it } from "vitest";

import type { GetGroupOutput } from "../api/group-detail-query";
import {
  draftFromGroup,
  emptyGroupFormDraft,
  isGroupFormDirty,
  parseGroupFormUiDraft,
  snapshotFromDraft,
  snapshotFromGroup,
  type GroupFormDraft,
} from "./group-form-draft";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

const loaded: GetGroupOutput = {
  id: GROUP_ID,
  name: "Оптові покупці",
  slug: "optovi-pokuptsi",
  description: "Для гурту",
  priceListId: PRICE_LIST_ID,
  memberCount: 3,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

function validCreateDraft(): GroupFormDraft {
  return {
    ...emptyGroupFormDraft(),
    name: "  Опт  ",
  };
}

describe("draftFromGroup / snapshotFromGroup", () => {
  it("prefills text fields and keeps the price-list id", () => {
    expect(draftFromGroup(loaded)).toEqual({
      name: "Оптові покупці",
      description: "Для гурту",
      priceListId: PRICE_LIST_ID,
    });
    expect(snapshotFromGroup(loaded).name).toBe("Оптові покупці");
    expect(snapshotFromGroup(loaded).priceListId).toBe(PRICE_LIST_ID);
    expect(snapshotFromGroup(loaded).description).toBe("Для гурту");
  });
});

describe("isGroupFormDirty", () => {
  it("is clean against the origin and dirty after a field or assignment change", () => {
    const origin = draftFromGroup(loaded);
    expect(isGroupFormDirty(origin, origin)).toBe(false);
    expect(isGroupFormDirty({ ...origin, name: "Інша" }, origin)).toBe(true);
    expect(isGroupFormDirty({ ...origin, priceListId: null }, origin)).toBe(
      true,
    );
  });
});

describe("snapshotFromDraft", () => {
  it("trims name and turns a blank description into inherit-null", () => {
    expect(snapshotFromDraft(validCreateDraft())).toEqual({
      name: "Опт",
      description: null,
      priceListId: null,
    });
    expect(snapshotFromDraft(emptyGroupFormDraft())).toBeNull();
    expect(parseGroupFormUiDraft(validCreateDraft()).ok).toBe(true);
  });
});
