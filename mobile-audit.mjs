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
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Movil QA" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Movil QA',$2,'supabase','admin',1)`, [user.id, email]);
let browser;
try {
  browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("https://coronel-dashboard.onrender.com/login", { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("https://coronel-dashboard.onrender.com/", { timeout: 60000 });
  await page.waitForSelector("nav.mobile-bottom-nav", { timeout: 90000 });
  await page.waitForTimeout(1400);
  for (const [id, label] of [["profile", "Mi cuenta"], ["promotions", "Promociones"], ["responsibles", "Encargados"], ["administracion", "Cuentas y accesos"]]) {
    await page.locator("nav.mobile-bottom-nav button:has-text('Más')").click();
    await page.waitForTimeout(300);
    const item = page.locator(".mobile-more-grid button").filter({ hasText: label }).first();
    if (await item.count()) await item.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `docs/screenshots/audit/mobile-${id}.png`, fullPage: true });
    console.log("shot", id);
  }
} catch (e) { console.error("MOBILE FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
