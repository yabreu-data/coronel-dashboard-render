import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `brand-${stamp}@coronel.local`;
const password = "Coronel-Brand-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Marca QA" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Marca QA',$2,'supabase','admin',1)`, [user.id, email]);
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
  console.log("count line:", await page.locator(".topbar-data-line").innerText());
  await page.screenshot({ path: "docs/screenshots/audit/brand-overview.png", fullPage: true });

  await page.click("button.nav-item:has-text('Voz del cliente')");
  await page.waitForTimeout(900);
  await page.locator(".word").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "docs/screenshots/audit/brand-wordcloud.png", fullPage: true });

  await page.click("button.nav-item:has-text('Mi cuenta')");
  await page.waitForTimeout(800);
  await page.locator("button:has-text('Editar nombre')").click();
  await page.locator("input[aria-label='Tu nombre']").fill("Marca QA Editada");
  await page.screenshot({ path: "docs/screenshots/audit/brand-name-edit.png", fullPage: true });
  await page.locator("button:has-text('Guardar')").first().click();
  await page.waitForTimeout(1000);
  console.log("name after:", await page.locator(".profile-name-line h3").innerText());

  await page.click("button.nav-item:has-text('Equipo')");
  await page.waitForTimeout(800);
  await page.locator(".team-targets-btn").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/screenshots/audit/brand-team-targets.png", fullPage: true });

  await page.locator("button:has-text('PDF')").first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "docs/screenshots/audit/brand-pdf.png", fullPage: true });
  console.log("BRAND OK");
} catch (e) { console.error("BRAND FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
