import { randomUUID } from "node:crypto";

import type { ChoiceRecord } from "@showzy/ai";
import { describe, expect, it } from "vitest";

import { createMemoryChoiceStore } from "./choice.js";

const conversationId = "11111111-1111-4111-8111-111111111111";
const otherConversationId = "12121212-1212-4212-8212-121212121212";
const companyId = "22222222-2222-4222-8222-222222222222";
const otherCompanyId = "23232323-2323-4232-8232-232323232323";
const productId = "44444444-4444-4444-8444-444444444444";
const variantLemon = "55555555-5555-4555-8555-555555555555";
const variantVanilla = "66666666-6666-4666-8666-666666666666";
const customerId = "77777777-7777-4777-8777-777777777777";
const optionLemon = "88888888-8888-4888-8888-888888888888";
const optionVanilla = "99999999-9999-4999-8999-999999999999";

function openRecord(choiceId: string = randomUUID()): ChoiceRecord {
  return {
    status: "open",
    choiceId,
    actorId: "anna",
    companyId,
    conversationId,
    canonicalInput: {
      customer: { by: "id", id: customerId },
      items: [
        {
          product: { by: "id", id: productId },
          variantSelection: { kind: "unspecified" },
          quantity: { milli: "1000" },
        },
      ],
    },
    target: { lineIndex: 0, productId, productName: "Macarons" },
    optionMap: {
      [optionLemon]: variantLemon,
      [optionVanilla]: variantVanilla,
    },
    envelope: {
      status: "needs_choice",
      challengeId: choiceId,
      reason: "variant_required",
      productName: "Macarons",
      options: [
        { id: optionLemon, label: "Lemon" },
        { id: optionVanilla, label: "Vanilla" },
      ],
      optionsTruncated: false,
    },
  };
}

const bind = {
  actorId: "anna",
  companyId,
  conversationId,
};

describe("createMemoryChoiceStore", () => {
  it("lets the first claim win and concurrent claims produce one winner", async () => {
    const store = createMemoryChoiceStore();
    const record = openRecord();
    expect(await store.open(record)).toBe(true);
    const [first, second] = await Promise.all([
      store.claim({
        choiceId: record.choiceId,
        bind,
        optionId: optionLemon,
      }),
      store.claim({
        choiceId: record.choiceId,
        bind,
        optionId: optionVanilla,
      }),
    ]);
    const kinds = [first.kind, second.kind].toSorted();
    expect(kinds).toEqual(["claimed", "conflict"]);
    const winner = first.kind === "claimed" ? first : second;
    expect(winner.kind).toBe("claimed");
    if (winner.kind !== "claimed") {
      return;
    }
    expect(winner.record.status).toBe("claimed");
    expect(
      winner.record.claimedOptionId === optionLemon ||
        winner.record.claimedOptionId === optionVanilla,
    ).toBe(true);
  });

  it("replays the same optionId after claim and rejects a different one", async () => {
    const store = createMemoryChoiceStore();
    const record = openRecord();
    await store.open(record);
    const claimed = await store.claim({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    expect(claimed.kind).toBe("claimed");
    const replay = await store.claim({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    expect(replay.kind).toBe("replay");
    if (replay.kind !== "replay") {
      return;
    }
    expect(replay.record.claimedOptionId).toBe(optionLemon);
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind,
        optionId: optionVanilla,
      }),
    ).toEqual({ kind: "conflict" });
  });

  it("returns expired without writing when the record is gone", async () => {
    const clock = { nowMs: 1_000_000 };
    const store = createMemoryChoiceStore({
      now: () => clock.nowMs,
      ttlMs: 50,
    });
    const record = openRecord();
    await store.open(record);
    clock.nowMs += 51;
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind,
        optionId: optionLemon,
      }),
    ).toEqual({ kind: "expired" });
    expect(await store.peek({ choiceId: record.choiceId, bind })).toEqual({
      kind: "expired",
    });
  });

  it("rejects wrong tenant, actor, and conversation without honouring client mapping", async () => {
    const store = createMemoryChoiceStore();
    const record = openRecord();
    await store.open(record);
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind: { ...bind, companyId: otherCompanyId },
        optionId: optionLemon,
      }),
    ).toEqual({ kind: "forbidden" });
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind: { ...bind, actorId: "boris" },
        optionId: optionLemon,
      }),
    ).toEqual({ kind: "forbidden" });
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind: { ...bind, conversationId: otherConversationId },
        optionId: optionLemon,
      }),
    ).toEqual({ kind: "forbidden" });
    expect(
      await store.claim({
        choiceId: record.choiceId,
        bind,
        optionId: variantLemon,
      }),
    ).toEqual({ kind: "invalid_option" });
    const peek = await store.peek({ choiceId: record.choiceId, bind });
    expect(peek.kind).toBe("found");
    if (peek.kind !== "found") {
      return;
    }
    expect(peek.record.status).toBe("open");
  });

  it("peek does not consume the record (not GETDEL)", async () => {
    const store = createMemoryChoiceStore();
    const record = openRecord();
    await store.open(record);
    const first = await store.peek({ choiceId: record.choiceId, bind });
    const second = await store.peek({ choiceId: record.choiceId, bind });
    expect(first.kind).toBe("found");
    expect(second.kind).toBe("found");
    const claimed = await store.claim({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    expect(claimed.kind).toBe("claimed");
  });

  it("marks completed only from claimed and replays the same option", async () => {
    const store = createMemoryChoiceStore();
    const record = openRecord();
    await store.open(record);
    expect(
      await store.complete({
        choiceId: record.choiceId,
        bind,
        optionId: optionLemon,
      }),
    ).toEqual({ kind: "conflict" });
    await store.claim({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    const done = await store.complete({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    expect(done.kind).toBe("completed");
    const replay = await store.complete({
      choiceId: record.choiceId,
      bind,
      optionId: optionLemon,
    });
    expect(replay.kind).toBe("replay");
    expect(
      await store.complete({
        choiceId: record.choiceId,
        bind,
        optionId: optionVanilla,
      }),
    ).toEqual({ kind: "conflict" });
  });
});
