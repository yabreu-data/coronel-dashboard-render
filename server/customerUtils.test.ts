import { describe, expect, it } from "vitest";
import { isBirthdayInNextDays } from "../shared/customerUtils";

describe("isBirthdayInNextDays", () => {
  it("includes a birthday occurring today", () => {
    expect(isBirthdayInNextDays("22/09/1990", new Date(2026, 8, 22))).toBe(true);
  });

  it("includes the next seven days but excludes the eighth day", () => {
    const reference = new Date(2026, 8, 22);
    expect(isBirthdayInNextDays("29/09/1990", reference)).toBe(true);
    expect(isBirthdayInNextDays("30/09/1990", reference)).toBe(false);
  });

  it("handles a birthday that is about to roll into the next year", () => {
    expect(isBirthdayInNextDays("02/01/1990", new Date(2026, 11, 29))).toBe(true);
    expect(isBirthdayInNextDays("10/01/1990", new Date(2026, 11, 29))).toBe(false);
  });
});
