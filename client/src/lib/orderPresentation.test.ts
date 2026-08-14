import { describe, expect, it } from "vitest";
import { formatChangeSummary, summarizeHistory } from "./orderPresentation";

describe("order presentation", () => {
  it("summarizes changes and their direction for the detail timeline", () => {
    const result = summarizeHistory([
      { changed: false, differenceDays: null },
      { changed: true, differenceDays: 14 },
      { changed: true, differenceDays: -7 },
    ]);

    expect(result).toEqual({
      uploadCount: 3,
      changeCount: 2,
      delayedChangeCount: 1,
      advancedChangeCount: 1,
    });
    expect(formatChangeSummary([
      { changed: false, differenceDays: null },
      { changed: true, differenceDays: 14 },
    ])).toBe("1 alteração(ões) em 2 upload(s)");
  });

  it("communicates when an item has no change history", () => {
    expect(formatChangeSummary([])).toBe("Sem alteração registrada");
  });
});
