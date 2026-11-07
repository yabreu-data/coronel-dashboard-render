import "dotenv/config";
import { chromium } from "playwright-core";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import pg from "pg";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/ux";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `p0-${stamp}@coronel.local`;
const password = "Coronel-P0-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "P0 Check" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'P0 Check',$2,'supabase','admin',1)`, [user.id, email]);

const qaKey = `qa-flow-${stamp}`;
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
await db.query(
  `INSERT INTO call_logs ("clientKey","clientName",phone,"callDate",outcome,promotion,"promotionRedeemed","nextCallDate","recoveryResult",notes,"createdBy") VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10)`,
  [qaKey, "Cliente QA P0", "999000111", new Date(), "Contactado", "Precio especial", yesterday, "Pendiente", "Registro de validación P0", "QA"]
);

const trpc = createTRPCClient({
  links: [httpBatchLink({ url: `${BASE}/api/trpc`, transformer: superjson })],
});

async function verifyClosure() {
  const closureKey = `qa-closure-${stamp}`;
  const priorityKey = `risk-${closureKey}`;
  const birthdayKey = `qa-birthday-${stamp}`;
  await db.query(
    `INSERT INTO birthday_campaigns ("clientKey","clientName",stage,channel,"progressStatus") VALUES ($1,$2,'week','llamada','pending')`,
    [birthdayKey, "Cumpleaños QA"]
  );
  await trpc.calls.create.mutate({
    clientKey: closureKey,
    clientName: "Cierre QA",
    phone: "999000222",
    outcome: "Contactado",
    promotion: "Precio especial",
    resolvePriorityKey: priorityKey,
  });
  await trpc.calls.create.mutate({
    clientKey: birthdayKey,
    clientName: "Cumpleaños QA",
    phone: "999000333",
    outcome: "Promoción aceptada",
    promotion: "Postre gratis",
    promotionRedeemed: true,
  });
  const priority = await db.query(`SELECT status FROM priority_items WHERE "priorityKey"=$1`, [priorityKey]);
  const campaign = await db.query(`SELECT "progressStatus" FROM birthday_campaigns WHERE "clientKey"=$1`, [birthdayKey]);
  console.log("closure:", priority.rows[0], "birthday:", campaign.rows[0]);
  return { closureKey, priorityKey, birthdayKey };
}

let browser;
let testKeys;
try {
  testKeys = await verifyClosure();
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/p0-overview.png`, fullPage: true });
  await page.locator(".quick-call-button").click();
  await page.waitForTimeout(400);
  await page.locator(".quick-call-result").filter({ hasText: "Prueba" }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/p0-call-priority-note.png`, fullPage: true });
  await page.locator(".call-modal .modal-actions button").first().click();
  await page.waitForTimeout(400);
  await page.click("button.nav-item:has-text('Llamadas')");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/p0-calls-agenda.png`, fullPage: true });
  const edit = page.locator("button:has-text('Editar')").first();
  if (await edit.count()) {
    await edit.click();
    await page.waitForTimeout(500);
    await page.locator(".bw-modal-actions button").first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/p0-calls-pin.png`, fullPage: true });
    await page.locator(".priority-pin-actions .btn-borde").click();
  }
  console.log("P0 UI OK");
} catch (e) { console.error("P0 FAIL", e instanceof Error ? e.message : String(e)); }
finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM call_logs WHERE "clientKey" LIKE 'qa-%'`).catch(() => undefined);
  await db.query(`DELETE FROM birthday_campaigns WHERE "clientKey" LIKE 'qa-%'`).catch(() => undefined);
  if (testKeys) {
    await db.query(`DELETE FROM priority_history WHERE "priorityKey"=$1`, [testKeys.priorityKey]).catch(() => undefined);
    await db.query(`DELETE FROM priority_items WHERE "priorityKey"=$1`, [testKeys.priorityKey]).catch(() => undefined);
  }
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
