import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const caller = appRouter.createCaller({
  user: undefined,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("targets delivery", () => {
  it("requires an independent delivery/web target when saving goals", async () => {
    await expect(
      caller.targets.save({ surveysPerServer: 10, positiveQualityPercent: 80 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

  it("requires the admin PIN to save goals", async () => {
    await expect(
      caller.targets.save({
        surveysPerServer: 10,
        surveysPerDelivery: 10,
        positiveQualityPercent: 80,
        adminPin: "0000",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
