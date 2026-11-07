import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/ux";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `flow-${stamp}@coronel.local`;
const password = "Coronel-Flow-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Flow Check" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Flow Check',$2,'supabase','admin',1)`, [user.id, email]);
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
  await page.screenshot({ path: `${OUT}/flow-overview.png`, fullPage: true });
  await page.locator(".quick-call-button").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/flow-quick-call.png`, fullPage: true });
  await page.locator(".quick-call-result").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/flow-call-form.png`, fullPage: true });
  await page.locator(".call-modal .modal-actions .btn-borde").click().catch(async () => {
    await page.locator(".call-modal .modal-actions button").first().click();
  });
  await page.waitForTimeout(400);
  await page.click("button.nav-item:has-text('Llamadas')");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/flow-calls-inbox.png`, fullPage: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mp.fill("#email", email); await mp.fill("#password", password);
  await mp.click('button[type="submit"]');
  await mp.waitForURL(`${BASE}/`, { timeout: 60000 });
  await mp.waitForTimeout(1400);
  await mp.screenshot({ path: `${OUT}/flow-mobile.png`, fullPage: true });
  console.log("FLOW OK");
} catch (e) { console.error("FLOW FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
