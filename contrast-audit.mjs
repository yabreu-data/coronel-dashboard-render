import "dotenv/config";
import { chromium } from "playwright-core";
import pg from "pg";
import fs from "node:fs";

const EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "https://coronel-dashboard.onrender.com";
const OUT = "docs/screenshots/ux";
const URL = process.env.SUPABASE_URL.replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `contrast-${stamp}@coronel.local`;
const password = "Coronel-Contrast-123!";
const admin = (path, options = {}) => fetch(`${URL}${path}`, { ...options, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(options.headers ?? {}) } }).then(r => r.json());

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const user = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Contrast Check" } }) });
await db.query(`INSERT INTO public."users" ("openId","name","email","loginMethod","role","active") VALUES ($1,'Contrast Check',$2,'supabase','admin',1)`, [user.id, email]);

const pages = [
  ["overview", "Centro de acción"], ["voice", "Voz del cliente"], ["team", "Equipo"],
  ["birthdays", "Cumpleaños"], ["clients", "Clientes"], ["priorities", "Prioridades"],
  ["promotions", "Promociones"], ["calls", "Llamadas"], ["responsibles", "Responsables"],
  ["targetHistory", "Historial de metas"], ["profile", "Mi perfil"], ["administracion", "Administración"],
];

const measure = () => {
  const parse = input => {
    const match = input.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
    if (!match) return null;
    return { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] };
  };
  const lum = c => {
    const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  };
  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const effectiveBg = element => {
    let color = { r: 255, g: 255, b: 255, a: 1 };
    let node = element;
    const stack = [];
    while (node && node !== document.documentElement) {
      const parsed = parse(getComputedStyle(node).backgroundColor);
      if (parsed && parsed.a > 0) stack.push(parsed);
      node = node.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) color = composite(stack[i], color);
    return color;
  };
  const selectorFor = el => {
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const issues = [];
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (!text || text.length < 2) continue;
    const el = walker.currentNode.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || +style.opacity < .1) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const color = parse(style.color);
    if (!color || color.a === 0) continue;
    const bg = effectiveBg(el);
    const ratio = contrast(composite(color, bg), bg);
    const fontSize = parseFloat(style.fontSize);
    const bold = parseInt(style.fontWeight) >= 600;
    const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
    const threshold = large ? 3 : 4.5;
    if (ratio < threshold) {
      const key = `${selectorFor(el)}|${style.color}|${Math.round(fontSize)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        selector: selectorFor(el),
        text: text.slice(0, 70),
        color: style.color,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        ratio: Math.round(ratio * 100) / 100,
        size: fontSize,
        threshold,
      });
    }
  }
  return issues.sort((a, b) => a.ratio - b.ratio);
};

let browser;
const report = {};
try {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email); await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60000 });
  await page.waitForSelector("button.nav-item", { timeout: 90000 });
  await page.waitForTimeout(2200);

  for (const [id, label] of pages) {
    await page.click(`button.nav-item:has-text('${label}')`);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/audit2-${id}.png`, fullPage: true });
    report[id] = await page.evaluate(measure);
    console.log(`\n## ${id} (${report[id].length})`);
    for (const issue of report[id].slice(0, 8)) console.log(`${issue.ratio} ${issue.selector} "${issue.text}" ${issue.color} on ${issue.bg} @${issue.size}px`);
  }

  // Hover de controles principales en Centro de acción
  await page.click("button.nav-item:has-text('Centro de acción')");
  await page.waitForTimeout(800);
  const hoverSelectors = [".nav-item", ".bw-action", ".small-action", ".filter-group button", ".pill", ".btn-borde", ".onboarding-steps > button", ".stat-card"];
  const hoverReport = [];
  for (const selector of hoverSelectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.count())) continue;
    const before = await locator.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, bg: s.backgroundColor, border: s.borderColor }; });
    await locator.hover();
    await page.waitForTimeout(250);
    const after = await locator.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, bg: s.backgroundColor, border: s.borderColor }; });
    hoverReport.push({ selector, before, after });
  }
  fs.writeFileSync(`${OUT}/contrast-report.json`, JSON.stringify({ report, hoverReport }, null, 2));
  console.log("\nHOVER");
  console.log(hoverReport);
} catch (error) {
  console.error("CONTRAST FAIL", error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close().catch(() => undefined);
  await db.query(`DELETE FROM public."users" WHERE "openId"=$1`, [user.id]).catch(() => undefined);
  await admin(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }).catch(() => undefined);
  await db.end().catch(() => undefined);
}
