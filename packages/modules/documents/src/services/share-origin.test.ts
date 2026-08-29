import { CoreInvariantError } from "@showzy/core/errors";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearDocumentShareOrigin,
  configureDocumentShareOrigin,
  getDocumentShareOrigin,
} from "./share-origin.js";

describe("document share origin", () => {
  afterEach(() => {
    configureDocumentShareOrigin("https://documents.test");
  });

  it("strips a trailing slash and returns the bound origin", () => {
    configureDocumentShareOrigin("https://showzy.test/");
    expect(getDocumentShareOrigin()).toBe("https://showzy.test");
  });

  it("fails closed when unbound", () => {
    clearDocumentShareOrigin();
    expect(() => getDocumentShareOrigin()).toThrow(CoreInvariantError);
  });
});
