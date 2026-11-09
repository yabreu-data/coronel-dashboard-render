import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `mobile-${stamp}@coronel.local`;
const password = "Coronel-Mobile-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Mobile QA" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Mobile QA',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const login = async (page) => {
    await page.goto("https://coronel-dashboard.onrender.com/login", { waitUntil: "networkidle" });
    await page.fill("#email", email); await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("https://coronel-dashboard.onrender.com/", { timeout: 60000 });
    await page.waitForTimeout(1000);
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await login(page);
  await page.click("button.nav-item:has-text('Cumpleaños')"); await page.waitForTimeout(900);
  const history = page.locator(".bw-card button:has-text('Historial')").first();
  if (await history.count()) { await history.scrollIntoViewIfNeeded(); await history.click(); await page.waitForTimeout(500); await page.screenshot({ path: "docs/screenshots/audit/final3-ficha.png", fullPage: false }); }
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await login(mp);
  await mp.screenshot({ path: "docs/screenshots/audit/final3-mobile-overview.png", fullPage: false });
  await mp.click("button.mobile-nav-item:has-text('Cumpleaños'), .mobile-bottom-nav button:has-text('Cumpleaños')").catch(() => {});
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: "docs/screenshots/audit/final3-mobile-birthdays.png", fullPage: false });
  console.log("MOBILE OK");
} catch (e) { console.error("MOBILE FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
