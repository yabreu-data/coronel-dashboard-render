import { describe, expect, it } from "vitest";
import { isWithinDateRange } from "../shared/teamUtils";

describe("isWithinDateRange", () => {
  it("incluye los límites del período y excluye fechas externas", () => {
    expect(isWithinDateRange("18/09/2026 10:00", "2026-09-18", "2026-09-24")).toBe(true);
    expect(isWithinDateRange("24/09/2026 23:59", "2026-09-18", "2026-09-24")).toBe(true);
    expect(isWithinDateRange("17/09/2026 23:59", "2026-09-18", "2026-09-24")).toBe(false);
    expect(isWithinDateRange("25/09/2026 00:01", "2026-09-18", "2026-09-24")).toBe(false);
  });

  it("rechaza un rango invertido y admite un solo límite", () => {
    expect(isWithinDateRange("20/09/2026", "2026-09-24", "2026-09-18")).toBe(false);
    expect(isWithinDateRange("20/09/2026", "2026-09-18", "")).toBe(true);
    expect(isWithinDateRange("20/09/2026", "", "2026-09-18")).toBe(false);
  });
});
