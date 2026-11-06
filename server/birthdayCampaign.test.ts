import { describe, expect, it } from "vitest";
import { getBirthdayCampaignMetrics, getBirthdayCampaignMonthlyMetrics, isCampaignAccepted } from "@shared/birthdayCampaignUtils";

describe("birthday campaign metrics", () => {
  it("recognizes accepted promotions without depending on accents or case", () => {
    expect(isCampaignAccepted({ promotion: "Cumple", outcome: "Promoción ACEPTADA", recoveryResult: null, promotionRedeemed: 0 })).toBe(true);
    expect(isCampaignAccepted({ promotion: "Cumple", outcome: "No contestó", recoveryResult: "Pendiente", promotionRedeemed: 0 })).toBe(false);
  });

  it("aggregates offers, acceptance and redemption rates per campaign", () => {
    const metrics = getBirthdayCampaignMetrics(["Cumple feliz", "Cliente fiel"], [
      { promotion: "Cumple feliz", outcome: "Promoción aceptada", recoveryResult: "Pendiente", promotionRedeemed: 0 },
      { promotion: "Cumple feliz", outcome: "Contactado", recoveryResult: "Cliente recuperado", promotionRedeemed: 1 },
      { promotion: "Cliente fiel", outcome: "No contestó", recoveryResult: "Pendiente", promotionRedeemed: 0 },
    ]);
    expect(metrics).toEqual([
      { name: "Cumple feliz", offered: 2, accepted: 1, redeemed: 1, acceptanceRate: 50, redemptionRate: 50 },
      { name: "Cliente fiel", offered: 1, accepted: 0, redeemed: 0, acceptanceRate: 0, redemptionRate: 0 },
    ]);
  });

  it("includes campaigns with no activity at zero", () => {
    expect(getBirthdayCampaignMetrics(["Sin registros"], [])).toEqual([
      { name: "Sin registros", offered: 0, accepted: 0, redeemed: 0, acceptanceRate: 0, redemptionRate: 0 },
    ]);
  });

  it("groups acceptance and redemption by month", () => {
    const metrics = getBirthdayCampaignMonthlyMetrics([
      { promotion: "Cumple", outcome: "Promoción aceptada", recoveryResult: null, promotionRedeemed: 1, callDate: "2026-09-04T10:00:00" },
      { promotion: "Cumple", outcome: "Contactado", recoveryResult: "Pendiente", promotionRedeemed: 0, callDate: "2026-09-18T10:00:00" },
      { promotion: "Cumple", outcome: "Promoción aceptada", recoveryResult: null, promotionRedeemed: 0, callDate: "2026-10-02T10:00:00" },
    ], "Cumple");
    expect(metrics.map(({ month, offered, accepted, redeemed }) => ({ month, offered, accepted, redeemed }))).toEqual([
      { month: "2026-09", offered: 2, accepted: 1, redeemed: 1 },
      { month: "2026-10", offered: 1, accepted: 1, redeemed: 0 },
    ]);
  });
});
