import { describe, expect, it } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import { waitLineAt } from "./wait-line";

const uk = assistantCopy("uk");
const en = assistantCopy("en");
const LINES = uk.waitLines;
const INTERVAL = uk.waitIntervalMs;

describe("waitLineAt", () => {
  it("pins 0ms, 1999ms, 2000ms, and 10000ms without a wall clock", () => {
    expect(INTERVAL).toBe(2000);
    expect(LINES).toHaveLength(5);
    expect(waitLineAt(0, LINES, INTERVAL)).toBe(LINES[0]);
    expect(waitLineAt(1999, LINES, INTERVAL)).toBe(LINES[0]);
    expect(waitLineAt(2000, LINES, INTERVAL)).toBe(LINES[1]);
    expect(waitLineAt(10000, LINES, INTERVAL)).toBe(LINES[0]);
  });

  it("cycles the locked uk/en pool and does not invent a done beat", () => {
    expect(waitLineAt(0, uk.waitLines, INTERVAL)).toBe("Копаюсь у даних");
    expect(waitLineAt(2000, uk.waitLines, INTERVAL)).toBe("Напав на слід");
    expect(waitLineAt(4000, uk.waitLines, INTERVAL)).toBe("Обнюхую записи");
    expect(waitLineAt(6000, uk.waitLines, INTERVAL)).toBe("Ще копну");
    expect(waitLineAt(8000, uk.waitLines, INTERVAL)).toBe(
      "Покопаю ще трошечки",
    );
    expect(waitLineAt(0, en.waitLines, INTERVAL)).toBe(
      "Digging through the data",
    );
    expect(waitLineAt(8000, en.waitLines, INTERVAL)).toBe(
      "I'll dig a little more",
    );
    const joined = `${uk.waitLines.join("\n")}\n${en.waitLines.join("\n")}`;
    expect(joined.includes("знайшов")).toBe(false);
    expect(joined.includes("готово")).toBe(false);
    expect(joined.includes("found")).toBe(false);
    expect(joined.includes("done")).toBe(false);
    expect(joined.includes("Шукаю замовлення")).toBe(false);
    expect(joined.includes("Рахую виторг")).toBe(false);
    expect(joined.includes("Looking up orders")).toBe(false);
    expect(joined.includes("Counting turnover")).toBe(false);
  });

  it("does not key the line on tool names or façade input", () => {
    const source = waitLineAt.toString();
    expect(source.includes("tool")).toBe(false);
    expect(source.includes("orders_list")).toBe(false);
    expect(source.includes("job")).toBe(false);
    expect(waitLineAt(0, LINES, INTERVAL)).toBe(
      waitLineAt(0, LINES, INTERVAL),
    );
  });
});
