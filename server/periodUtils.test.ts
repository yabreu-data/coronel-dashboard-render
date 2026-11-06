import { describe, expect, it } from "vitest";
import { getPreviousPeriod } from "../shared/periodUtils";

const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

describe("getPreviousPeriod", () => {
  it("calcula un período anterior con la misma duración", () => {
    const result = getPreviousPeriod("2026-09-18", "2026-09-24");
    expect(result?.from && localDate(result.from)).toBe("2026-09-11");
    expect(result?.to && localDate(result.to)).toBe("2026-09-17");
  });

  it("funciona al cruzar de mes y rechaza rangos incompletos o invertidos", () => {
    const result = getPreviousPeriod("2026-09-01", "2026-09-03");
    expect(result?.from && localDate(result.from)).toBe("2026-08-29");
    expect(result?.to && localDate(result.to)).toBe("2026-08-31");
    expect(getPreviousPeriod("2026-09-03", "2026-09-01")).toBeNull();
    expect(getPreviousPeriod("", "2026-09-01")).toBeNull();
  });
});
