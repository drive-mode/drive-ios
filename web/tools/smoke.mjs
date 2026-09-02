#!/usr/bin/env node
// Headless walk of the local build: loads the app in a phone-sized Chromium,
// runs a step list, screenshots, and fails on console errors/warnings.
//
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node tools/smoke.mjs
//   STEPS_FILE=tools/steps/full.json OUT=./shots node tools/smoke.mjs
//
// Env: BASE (default http://127.0.0.1:8787/), QUERY (e.g. ?channel=production),
// SCHEME (dark|light), OUT (screenshot dir), STEPS / STEPS_FILE (JSON list of
// [op, arg]: click, tab, shot, wait, eval, key, tap, scroll, fill),
// CHROMIUM (executable path; otherwise Playwright's bundled browser).
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const corePath = process.env.PLAYWRIGHT_CORE ?? "playwright-core";
let chromium;
try { ({ chromium } = require(corePath)); }
catch { console.error(`playwright-core not found (${corePath}). Set PLAYWRIGHT_CORE to its directory.`); process.exit(2); }

const OUT = resolve(process.env.OUT ?? "shots");
mkdirSync(OUT, { recursive: true });
const base = process.env.BASE ?? "http://127.0.0.1:8787/";
const steps = process.env.STEPS_FILE
  ? JSON.parse(readFileSync(process.env.STEPS_FILE, "utf8"))
  : JSON.parse(process.env.STEPS ?? "null") ?? [["click", "text=Open"], ["shot", "home"], ["tab", "work"], ["shot", "work"], ["tab", "agents"], ["shot", "agents"], ["tab", "tasks"], ["shot", "tasks"]];

const launch = { args: ["--no-sandbox"] };
if (process.env.CHROMIUM && existsSync(process.env.CHROMIUM)) launch.executablePath = process.env.CHROMIUM;
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME ?? "dark" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(base + (process.env.QUERY ?? ""), { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
await shot("00-open");
for (const [op, arg] of steps) {
  try {
    if (op === "click") await page.click(arg, { timeout: 3000 });
    else if (op === "tab") { await page.evaluate(() => window.drive.store.summonTabBar()); await page.waitForTimeout(120); await page.click(`nav.tabbar [aria-label="${arg[0].toUpperCase() + arg.slice(1)}"]`, { timeout: 3000 }); }
    else if (op === "shot") await shot(arg);
    else if (op === "wait") await page.waitForTimeout(arg);
    else if (op === "eval") { const r = await page.evaluate(arg); if (r !== undefined) console.log(r); }
    else if (op === "key") await page.keyboard.press(arg);
    else if (op === "tap") await page.touchscreen.tap(arg[0], arg[1]);
    else if (op === "scroll") await page.mouse.wheel(0, arg);
    else if (op === "fill") await page.fill(arg[0], arg[1]);
    await page.waitForTimeout(350);
  } catch (e) { errors.push(`[step ${op} ${JSON.stringify(arg)}] ${e.message.split("\n")[0]}`); await shot(`err-${op}`); }
}
console.log(errors.length ? errors.join("\n") : "NO CONSOLE ERRORS");
await browser.close();
process.exit(errors.length ? 1 : 0);
