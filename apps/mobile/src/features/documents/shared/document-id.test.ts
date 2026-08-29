import { describe, expect, it } from "vitest";

import {
  documentIdFromParam,
  orderIdFromParam,
  uuidFromParam,
} from "./document-id";

const ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("uuidFromParam", () => {
  it("accepts a UUID and refuses anything else", () => {
    expect(uuidFromParam(ID)).toBe(ID);
    expect(documentIdFromParam([ID])).toBe(ID);
    expect(orderIdFromParam(ID)).toBe(ID);
    expect(uuidFromParam(undefined)).toBeNull();
    expect(uuidFromParam("")).toBeNull();
    expect(uuidFromParam("not-a-uuid")).toBeNull();
  });
});
