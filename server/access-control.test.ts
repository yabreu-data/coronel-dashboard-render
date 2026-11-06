import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("access control and session history", () => {
  it("does not expose system users to an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.accessUsers.list()).resolves.toEqual([]);
  });

  it("returns an empty session history for an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.auth.sessions()).resolves.toEqual([]);
  });

  it("does not expose the administrative session history or its user filter to an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.auth.adminSessions({ page: 1, pageSize: 20, userQuery: "ana" })).resolves.toEqual({ rows: [], total: 0 });
  });
});
