import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAMP = Date.now();
const email = `qa-metrics-${STAMP}@coronel.local`;
const password = "Coronel-QA-123!";
const results = [];
const record = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const admin = (path, options = {}) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  }).then(async response => ({ ok: response.ok, payload: await response.json().catch(() => null) }));

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const created = await admin("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "QA Datos" } }),
});
const userId = created.payload.id;
await db.query(
  `INSERT INTO public."users" ("openId", "name", "email", "loginMethod", "role", "active") VALUES ($1, 'QA Datos', $2, 'supabase', 'admin', 1)`,
  [userId, email]
);

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await page.waitForSelector("button.nav-item", { timeout: 90_000 });
  await page.waitForTimeout(2500);

  const readStats = async () =>
    (await page.locator(".stat-card").allInnerTexts()).map(text => text.replace(/\s+/g, " ").trim());

  const go = async (label) => {
    await page.click(`button.nav-item:has-text('${label}')`);
    await page.waitForTimeout(1800);
  };

  // Centro de acción
  await go("Centro de acción");
  await page.screenshot({ path: process.env.SHOT_OVERVIEW });
  console.log("\n[Centro de acción]\n" + (await readStats()).join("\n"));

  // Voz del cliente
  await go("Voz del cliente");
  await page.screenshot({ path: process.env.SHOT_VOICE, fullPage: true });
  console.log("\n[Voz del cliente]\n" + (await readStats()).join("\n"));
  const repeated = await page.locator(".voice-list-item").allInnerTexts();
  console.log("Repetidos/pedidos:", repeated.slice(0, 8).map(text => text.replace(/\s+/g, " ").trim()));

  // Equipo
  await go("Equipo");
  await page.screenshot({ path: process.env.SHOT_TEAM, fullPage: true });
  console.log("\n[Equipo]\n" + (await readStats()).join("\n"));
  const teamRows = await page.locator("table tbody tr").allInnerTexts();
  console.log("Equipo filas:", teamRows.slice(0, 8).map(text => text.replace(/\s+/g, " ").trim()));

  // Cumpleaños
  await go("Cumpleaños");
  await page.waitForSelector(".bw-panel", { timeout: 45_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOT_BIRTHDAY, fullPage: true });
  const birthdayMetrics = await page.locator(".bw-metric").allInnerTexts();
  console.log("\n[Cumpleaños métricas]\n" + birthdayMetrics.map(text => text.replace(/\s+/g, " ").trim()).join("\n"));
  const chips = await page.locator(".bw-chip, .bw-funnel-step").allInnerTexts();
  console.log("Chips/embudo:", chips.slice(0, 12).map(text => text.replace(/\s+/g, " ").trim()));

  record("la UI carga sin errores de JavaScript", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (error) {
  console.error("FALLO UI:", error instanceof Error ? error.message : String(error));
  results.push(false);
} finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId" = $1`, [userId]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
  console.log(`\n== Resultado: ${results.filter(Boolean).length}/${results.length} ==`);
  if (results.some(value => !value)) process.exitCode = 1;
}
