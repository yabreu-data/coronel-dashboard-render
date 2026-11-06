/** Utilidades de métricas compartidas por el dashboard y las pruebas. */

const SCORED_QUALITIES = new Set(["bueno", "regular", "malo"]);

function normalizeMetricText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Calidad que entra en el denominador de positividad (excluye "Sin calificar"). */
export function hasScoredQuality(quality: string): boolean {
  return SCORED_QUALITIES.has(normalizeMetricText(quality));
}

export function positiveStats(records: { quality: string }[]) {
  const answered = records.filter(record => hasScoredQuality(record.quality));
  const good = answered.filter(record => normalizeMetricText(record.quality) === "bueno").length;
  return {
    answered: answered.length,
    good,
    rate: answered.length ? good / answered.length : 0,
  };
}

/** Tasa de respuesta de calidad: cuántas encuestas tienen Bueno/Regular/Malo. */
export function qualityResponseRate(records: { quality: string }[]) {
  if (!records.length) return 0;
  return records.filter(record => hasScoredQuality(record.quality)).length / records.length;
}

/**
 * Intervalo de confianza de Wilson (95 % por defecto) para una proporción.
 * Es más estable que el intervalo normal cuando n es pequeño o p está cerca
 * de 0 o 1, que es justo el caso de los meseros con 19–37 respuestas.
 */
export function wilsonInterval(
  successes: number,
  total: number,
  z = 1.96
): [number, number] | null {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0) return null;
  const safeSuccesses = Math.min(Math.max(successes, 0), total);
  const p = safeSuccesses / total;
  const denominator = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denominator;
  const margin =
    (z / denominator) *
    Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}
