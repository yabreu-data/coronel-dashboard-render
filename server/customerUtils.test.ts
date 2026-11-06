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

  it("interpreta años de dos dígitos sin confundir mes y día", () => {
    // 08/11/83 = 8 de noviembre de 1983 (antes se leía como agosto).
    expect(isBirthdayInNextDays("08/11/83", new Date(2026, 10, 6))).toBe(true);
    expect(isBirthdayInNextDays("15/11/89", new Date(2026, 10, 10))).toBe(true);
  });

  it("acepta cumpleaños sin año (dd/mm)", () => {
    expect(isBirthdayInNextDays("05/11", new Date(2026, 10, 4))).toBe(true);
    expect(isBirthdayInNextDays("05/11", new Date(2026, 10, 6))).toBe(false);
  });
});
