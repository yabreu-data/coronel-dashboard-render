import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `bistro-${stamp}@coronel.local`;
const password = "Coronel-Bistro-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Bistro QA" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Bistro QA',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("https://coronel-dashboard.onrender.com/login", { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("https://coronel-dashboard.onrender.com/", { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "docs/screenshots/audit/bistro-overview.png", fullPage: true });
  await page.click("button.nav-item:has-text('Voz del cliente')");
  await page.waitForTimeout(900);
  await page.locator(".sentiment-word").first().click();
  await page.waitForTimeout(400);
  const pColor = await page.locator(".comment-modal p").first().evaluate(el => getComputedStyle(el).color);
  const articleColor = await page.locator(".highlight-comments article p").first().evaluate(el => getComputedStyle(el).color);
  console.log("modal p color", pColor, "article", articleColor);
  await page.screenshot({ path: "docs/screenshots/audit/bistro-context.png", fullPage: false });
  await page.locator(".comment-modal .icon-button").click();
  await page.click("button.nav-item:has-text('Clientes')");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/screenshots/audit/bistro-clients.png", fullPage: true });
  await page.locator("button:has-text('PDF')").first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/screenshots/audit/bistro-pdf.png", fullPage: true });
  console.log("BISTRO OK");
} catch (e) { console.error("BISTRO FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
