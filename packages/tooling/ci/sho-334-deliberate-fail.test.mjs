import assert from "node:assert/strict";
import { test } from "node:test";

test("SHO-334 deliberate aggregator failure probe", () => {
  assert.equal(
    "green",
    "red",
    "temporary probe: a required worker must fail so checks cannot stay green",
  );
});
