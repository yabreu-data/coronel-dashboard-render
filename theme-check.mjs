import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/ux";
const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAMP = Date.now();
const email = `theme-${STAMP}@coronel.local`;
const password = "Coronel-Theme-123!";

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
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Theme Check" } }),
});
const userId = created.payload.id;
await db.query(
  `INSERT INTO public."users" ("openId", "name", "email", "loginMethod", "role", "active") VALUES ($1, 'Theme Check', $2, 'supabase', 'admin', 1)`,
  [userId, email]
);

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/theme-login.png`, fullPage: true });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await page.waitForSelector("button.nav-item", { timeout: 90_000 });
  await page.waitForTimeout(2500);
  for (const [id, label] of [
    ["overview", "Centro de acción"],
    ["birthdays", "Cumpleaños"],
    ["team", "Equipo"],
    ["clients", "Clientes"],
  ]) {
    await page.click(`button.nav-item:has-text('${label}')`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/theme-${id}.png`, fullPage: true });
  }
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mp.fill("#email", email);
  await mp.fill("#password", password);
  await mp.click('button[type="submit"]');
  await mp.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await mp.waitForTimeout(2500);
  await mp.screenshot({ path: `${OUT}/theme-mobile.png`, fullPage: true });
  console.log("THEME OK");
} catch (error) {
  console.error("THEME FAIL", error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId" = $1`, [userId]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
