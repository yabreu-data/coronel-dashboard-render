import { describe, expect, it } from "vitest";
import {
  hasScoredQuality,
  positiveStats,
  qualityResponseRate,
  wilsonInterval,
} from "../shared/metricsUtils";

describe("métricas de calidad", () => {
  it("excluye Sin calificar del denominador de positividad", () => {
    const records = [
      { quality: "Bueno" },
      { quality: "Bueno" },
      { quality: "Regular" },
      { quality: "Malo" },
      { quality: "Sin calificar" },
      { quality: "" },
    ];
    expect(positiveStats(records)).toEqual({
      answered: 4,
      good: 2,
      rate: 0.5,
    });
    expect(qualityResponseRate(records)).toBeCloseTo(4 / 6);
  });

  it("reconoce la calidad sin importar mayúsculas o tildes", () => {
    expect(hasScoredQuality("Bueno")).toBe(true);
    expect(hasScoredQuality("REGULAR")).toBe(true);
    expect(hasScoredQuality("malo")).toBe(true);
    expect(hasScoredQuality("Sin calificar")).toBe(false);
    expect(hasScoredQuality("")).toBe(false);
  });

  it("calcula el intervalo de Wilson para los meseros", () => {
    const shirley = wilsonInterval(35, 37);
    expect(shirley).not.toBeNull();
    expect(shirley![0]).toBeCloseTo(0.823, 3);
    expect(shirley![1]).toBeCloseTo(0.985, 3);

    const betty = wilsonInterval(17, 19);
    expect(betty![0]).toBeCloseTo(0.686, 2);
    expect(betty![1]).toBeCloseTo(0.970, 2);
  });

  it("devuelve null cuando no hay datos", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
  });
});
