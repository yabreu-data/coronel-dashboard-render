import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("calls.list", () => {
  it("returns a list-shaped result without creating test data", async () => {
    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} },
      res: {},
    } as TrpcContext;
    const result = await appRouter.createCaller(ctx).calls.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
