import { describe, expect, it } from "vitest";
import { getPendingAgingSummary } from "./pendingAging";

describe("getPendingAgingSummary", () => {
  it("classifica pendências únicas nas quatro faixas a partir da Data de criação", () => {
    const referenceDate = new Date("2026-08-17T12:00:00.000Z");
    const summary = getPendingAgingSummary([
      { orderItemId: 1, orderCreationDate: "2026-08-10", status: "active" },
      { orderItemId: 2, orderCreationDate: "2026-07-01", status: "active" },
      { orderItemId: 3, orderCreationDate: "2026-05-20", status: "active" },
      { orderItemId: 4, orderCreationDate: "2026-05-19", status: "active" },
      { orderItemId: 5, orderCreationDate: "2026-04-01", status: "active" },
      { orderItemId: 1, orderCreationDate: "2026-08-10", status: "active" },
      { orderItemId: 6, orderCreationDate: "Sem previsão", status: "active" },
      { orderItemId: 7, orderCreationDate: "2026-01-01", status: "delivered" },
    ], referenceDate);

    expect(summary).toEqual({
      total: 6,
      upTo30: 1,
      from31To60: 1,
      from61To90: 2,
      above90: 1,
      withoutCreationDate: 1,
      itemsWithCreationDate: 5,
      averageAgeInDays: 74,
    });
  });
});
