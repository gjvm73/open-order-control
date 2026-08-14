import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("orders router", () => {
  it("allows public procedure to list items and stats", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.orders.getStats();
    expect(stats).toHaveProperty("totalItems");
    expect(stats).toHaveProperty("changedLastUpload");

    const items = await caller.orders.listItems();
    expect(Array.isArray(items)).toBe(true);
  });
});
