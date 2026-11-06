import "dotenv/config";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Verifica la conexión del dashboard con su fuente de datos (Google Sheets).
 *
 * - Comprueba que la hoja sea legible sin autenticación (gviz público).
 * - Compara la pestaña configurada contra un nombre inexistente para detectar
 *   si el nombre realmente existe o si Google devuelve la primera hoja.
 * - Consulta el endpoint público del dashboard y valida los campos.
 *
 * Uso: node scripts/verify-sheets.mjs [urlProduccion]
 */

const BASE = (process.argv[2] || "https://coronel-dashboard.onrender.com").replace(/\/+$/, "");
const SHEET_ID = (process.env.GOOGLE_SHEET_ID || "1q9WMz_O_J15B0QKv8QF4zYp7uvwGwm-5aTGfTdz6vHU").trim();
const CONFIGURED_TAB = (process.env.GOOGLE_SHEET_TAB || "Encuestas_Limpias").trim();
const FALLBACK_TAB = "Encuestas";
const results = [];
const record = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

async function fetchFirstRow(sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&range=A1%3AZ1`;
  const started = Date.now();
  const response = await fetch(url);
  const text = (await response.text()).trim();
  return { ok: response.ok, status: response.status, ms: Date.now() - started, firstRow: text ? parseCsvLine(text.split(/\r?\n/)[0]) : [] };
}

async function main() {
  console.log(`\n== Verificación de fuente de datos · Google Sheets ==\n`);
  console.log(`ID del Sheet: ${SHEET_ID}`);
  console.log(`Pestaña configurada (GOOGLE_SHEET_TAB): ${CONFIGURED_TAB}`);
  console.log(`Dashboard: ${BASE}\n`);

  if (!SHEET_ID) {
    record("GOOGLE_SHEET_ID configurado", false);
    return;
  }

  const configured = await fetchFirstRow(CONFIGURED_TAB).catch(error => ({ ok: false, error }));
  const fallback = await fetchFirstRow(FALLBACK_TAB).catch(error => ({ ok: false, error }));
  const impossible = await fetchFirstRow("TAB_QUE_NO_EXISTE_123").catch(error => ({ ok: false, error }));

  record("la hoja es pública (gviz responde sin autenticación)", configured.ok === true, `HTTP ${configured.status ?? "?"} · ${configured.ms ?? "?"} ms`);

  const configuredLooksMissing =
    configured.firstRow?.join("|") === impossible.firstRow?.join("|");
  if (configuredLooksMissing) {
    console.log(
      `⚠ AVISO · la pestaña configurada "${CONFIGURED_TAB}" no existe; Google devuelve la primera hoja ("${(impossible.firstRow ?? []).slice(0, 3).join(" · ")}").`
    );
  } else {
    record(
      `la pestaña configurada existe en el Sheet (${CONFIGURED_TAB})`,
      true,
      `encabezados: ${configured.firstRow?.slice(0, 6).join(" | ")}`
    );
  }

  const hasSurveyHeaders = (row) =>
    row?.some(value => ["ID Único", "id", "ID de Envío"].includes(String(value).trim())) &&
    row?.some(value => ["Timestamp", "timestamp"].includes(String(value).trim()));
  record(
    `la pestaña de encuestas tiene los encabezados esperados (${FALLBACK_TAB})`,
    hasSurveyHeaders(fallback.firstRow),
    (fallback.firstRow ?? []).slice(0, 8).join(" | ")
  );
  if (!configuredLooksMissing) {
    const cleanHeaders = configured.firstRow?.map(value => String(value).trim()) ?? [];
    record(
      "la pestaña limpia tiene columnas de control",
      cleanHeaders.includes("Estado Registro") && cleanHeaders.includes("Opinión Limpia"),
      cleanHeaders.filter(value => ["Estado Registro", "Comentario Válido", "Opinión Limpia", "Calidad Limpia"].includes(value)).join(", ")
    );
  }

  const client = createTRPCClient({
    links: [httpBatchLink({ url: `${BASE}/api/trpc`, transformer: superjson })],
  });
  try {
    const started = Date.now();
    const data = await client.survey.latest.query();
    const ms = Date.now() - started;
    record("el dashboard entrega datos de la hoja", data.records.length > 0, `${data.records.length} encuestas · ${data.serverCatalog.length} meseros · ${ms} ms`);
    const expectedFallback = configuredLooksMissing;
    record(
      "coherencia fuente/fallback del dashboard",
      data.fallbackUsed === expectedFallback,
      `fallbackUsed=${data.fallbackUsed} (esperado: ${expectedFallback})`
    );
    if (expectedFallback) {
      record(
        "aviso de datos sin depurar presente",
        Boolean(data.warning),
        data.warning ? "sí" : "no"
      );
    }
    const expectedSource = configuredLooksMissing ? FALLBACK_TAB : CONFIGURED_TAB;
    record(
      "fuente efectiva usada por el dashboard",
      data.source.includes(expectedSource),
      `${data.source} (esperado: ${expectedSource})`
    );
    const sample = data.records[0] ?? {};
    record(
      "los registros traen los campos necesarios",
      Boolean(sample.id && sample.timestamp && sample.clientName !== undefined),
      JSON.stringify({ id: sample.id, timestamp: sample.timestamp, cliente: sample.clientName, calidad: sample.quality })
    );
    record(
      "cumpleaños y mesero se leen correctamente",
      Boolean(sample.birthday || sample.registeredBy),
      `cumpleaños=${sample.birthday || "—"} · mesero=${sample.registeredBy || "—"}`
    );
    if (configuredLooksMissing) {
      console.log(`   Fallback funcionando: el dashboard usa "${expectedSource}" mientras "${CONFIGURED_TAB}" no exista.`);
    }
  } catch (error) {
    record("el dashboard entrega datos de la hoja", false, error instanceof Error ? error.message : String(error));
  }

  const failed = results.filter(value => !value).length;
  console.log(`\n== Resultado: ${results.length - failed}/${results.length} OK ==`);
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error("Error inesperado:", error);
  process.exitCode = 1;
});
