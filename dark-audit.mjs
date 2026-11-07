import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `dark-${stamp}@coronel.local`;
const password = "Coronel-Dark-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Dark Check" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Dark Check',$2,'supabase','admin',1)`, [user.id, email]);

const pages = [
  ["promotions", "Promociones"], ["voice", "Voz del cliente"], ["priorities", "Prioridades"],
  ["targetHistory", "Historial de metas"], ["clients", "Clientes"], ["birthdays", "Cumpleaños"],
  ["team", "Equipo"], ["calls", "Llamadas"], ["administracion", "Administración"], ["responsibles", "Responsables"],
];

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(2000);
  for (const [id, label] of pages) {
    await page.click(`button.nav-item:has-text('${label}')`);
    await page.waitForTimeout(1200);
    const dark = await page.evaluate(() => {
      const parse = value => {
        const m = value.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
      };
      const lum = c => {
        const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
      };
      const css = el => {
        if (!el || el === document.body) return "body";
        const parts = [];
        let node = el;
        while (node && node !== document.body && parts.length < 4) {
          let part = node.tagName.toLowerCase();
          if (node.id) { part += `#${node.id}`; parts.unshift(part); break; }
          if (node.classList.length) part += "." + [...node.classList].slice(0, 2).join(".");
          parts.unshift(part);
          node = node.parentElement;
        }
        return parts.join(" > ");
      };
      const seen = new Set();
      return [...document.querySelectorAll(".content *")]
        .filter(el => {
          const s = getComputedStyle(el);
          const bg = parse(s.backgroundColor);
          if (!bg || bg.a < .5) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 18) return false;
          if (s.display === "none" || s.visibility === "hidden") return false;
          return lum(bg) < .14;
        })
        .map(el => {
          const s = getComputedStyle(el);
          return { selector: css(el), bg: s.backgroundColor, color: s.color, text: (el.textContent || "").trim().slice(0, 45) };
        })
        .filter(item => {
          const key = item.selector + item.bg;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    });
    console.log(`\n## ${id} (${dark.length})`);
    dark.slice(0, 20).forEach(item => console.log(item.selector, "|", item.bg, "|", item.color, "|", JSON.stringify(item.text)));
  }
} catch (error) {
  console.error("DARK FAIL", error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
