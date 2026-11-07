import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/ux";
const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAMP = Date.now();
const email = `ux-audit-${STAMP}@coronel.local`;
const password = "Coronel-UX-123!";

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
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "UX Audit" } }),
});
const userId = created.payload.id;
await db.query(
  `INSERT INTO public."users" ("openId", "name", "email", "loginMethod", "role", "active") VALUES ($1, 'UX Audit', $2, 'supabase', 'admin', 1)`,
  [userId, email]
);

const pages = [
  ["overview", "Centro de acción"],
  ["voice", "Voz del cliente"],
  ["team", "Equipo"],
  ["birthdays", "Cumpleaños"],
  ["clients", "Clientes"],
  ["priorities", "Prioridades"],
  ["promotions", "Promociones"],
  ["calls", "Llamadas"],
  ["responsibles", "Responsables"],
  ["targetHistory", "Historial de metas"],
  ["profile", "Mi perfil"],
  ["administracion", "Administración"],
];

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  // Login desktop
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/login-desktop.png`, fullPage: true });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await page.waitForSelector("button.nav-item", { timeout: 90_000 });
  await page.waitForTimeout(2500);

  for (const [id, label] of pages) {
    const nav = page.locator(`button.nav-item:has-text('${label}')`);
    if ((await nav.count()) === 0) {
      console.log(`NAV NO ENCONTRADO: ${label}`);
      continue;
    }
    await nav.first().click();
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/${id}-desktop.png`, fullPage: true });
    const title = await page.locator("h2").first().innerText().catch(() => "");
    console.log(`${label} → ${title.replace(/\s+/g, " ").trim()}`);
  }

  // Mobile: login + main pages
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `${OUT}/login-mobile.png`, fullPage: true });
  await mp.fill("#email", email);
  await mp.fill("#password", password);
  await mp.click('button[type="submit"]');
  await mp.waitForURL(`${BASE}/`, { timeout: 60_000 });
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: `${OUT}/overview-mobile.png`, fullPage: true });

  // Abrir menú móvil si existe el botón
  const menuCandidates = [
    'button[aria-label*="menú" i]',
    'button[aria-label*="menu" i]',
    ".mobile-menu-button",
    ".hamburger",
    "button:has(svg.lucide-menu)",
  ];
  for (const selector of menuCandidates) {
    const button = mp.locator(selector).first();
    if ((await button.count()) > 0) {
      await button.click().catch(() => undefined);
      await mp.waitForTimeout(700);
      await mp.screenshot({ path: `${OUT}/menu-mobile.png`, fullPage: false });
      break;
    }
  }

  console.log("ERRORES JS:", errors.slice(0, 8));
} catch (error) {
  console.error("FALLO UX:", error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId" = $1`, [userId]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
  console.log("AUDIT OK");
}
