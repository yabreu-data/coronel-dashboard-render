import { describe, expect, it } from "vitest";
import { nextPriorityStatus, sortPriorities } from "@shared/priorityUtils";

describe("sortPriorities", () => {
  it("ordena por urgencia, usa el título como desempate y limita a cinco", () => {
    const result = sortPriorities([
      { score: 70, title: "Regular B" },
      { score: 100, title: "Mala" },
      { score: 85, title: "Cumpleaños" },
      { score: 70, title: "Regular A" },
      { score: 60, title: "Sexta" },
      { score: 50, title: "Séptima" },
    ]);

    expect(result.map(item => item.title)).toEqual(["Mala", "Cumpleaños", "Regular A", "Regular B", "Sexta"]);
  });

  it("avanza por los tres estados operativos y vuelve a pendiente al cerrar", () => {
    expect(nextPriorityStatus("pending")).toBe("in_progress");
    expect(nextPriorityStatus("in_progress")).toBe("done");
    expect(nextPriorityStatus("done")).toBe("pending");
  });
});
