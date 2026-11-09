import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `session-${stamp}@coronel.local`;
const password = "Coronel-Session-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Yennifer Abreu" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Yennifer Abreu',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("https://coronel-dashboard.onrender.com/login", { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("https://coronel-dashboard.onrender.com/", { timeout: 60000 });
  await page.waitForSelector("button.account-trigger", { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/screenshots/audit/session-topbar.png", fullPage: false });
  await page.click("button.account-trigger"); await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/audit/session-menu.png", fullPage: false });
  await page.click("button.nav-item:has-text('Cumpleaños')"); await page.waitForTimeout(1000);
  await page.screenshot({ path: "docs/screenshots/audit/session-birthdays.png", fullPage: false });
  await page.click("button.nav-item:has-text('Clientes')"); await page.waitForTimeout(700);
  await page.click(".client-row, .clients-row button, .client-card").catch(() => {});
  await page.waitForTimeout(500);
  console.log("SESSION OK");
} catch (e) { console.error("SESSION FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
