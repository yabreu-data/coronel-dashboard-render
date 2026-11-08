import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `sheet-${stamp}@coronel.local`;
const password = "Coronel-Sheet-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Sheet QA" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Sheet QA',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const scroller = document.querySelector(".main-area");
    if (scroller) scroller.scrollTop = 900;
  });
  const before = await page.evaluate(
    () => document.querySelector(".main-area")?.scrollTop ?? 0
  );
  await page.locator(".today-client").first().click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(
    () => document.querySelector(".main-area")?.scrollTop ?? 0
  );
  const rect = await page.locator(".client-sheet").boundingBox();
  console.log("scroll before/after:", before, after, "sheet:", rect);
  await page.screenshot({ path: "docs/screenshots/audit/client-sheet.png", fullPage: false });
  await page.locator(".client-sheet-head .icon-button").click();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mp.fill("#email", email); await mp.fill("#password", password);
  await mp.click('button[type="submit"]');
  await mp.waitForURL(`${BASE}/`, { timeout: 60000 });
  await mp.waitForTimeout(1300);
  await mp.locator(".today-client").first().click();
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: "docs/screenshots/audit/client-sheet-mobile.png", fullPage: false });
  console.log("SHEET OK");
} catch (e) { console.error("SHEET FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
