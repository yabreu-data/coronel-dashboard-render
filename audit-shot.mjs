import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/audit";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `audit-${stamp}@coronel.local`;
const password = "Coronel-Audit-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "QA Experto" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'QA Experto',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(1600);
  const pages = [
    ["overview", "Centro de acción"],
    ["birthdays", "Cumpleaños"],
    ["clients", "Clientes"],
    ["priorities", "Prioridades"],
    ["calls", "Llamadas"],
    ["voice", "Voz del cliente"],
    ["team", "Equipo"],
    ["targetHistory", "Historial de metas"],
    ["promotions", "Promociones"],
    ["responsibles", "Encargados"],
    ["profile", "Mi cuenta"],
    ["administracion", "Cuentas y accesos"],
  ];
  for (const [id, label] of pages) {
    await page.click(`button.nav-item:has-text('${label}')`);
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: true });
    console.log("shot", id);
  }
  console.log("AUDIT OK");
} catch (e) { console.error("AUDIT FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
