/**
 * Prerender the marketing SPA to static HTML.
 *
 * Why: no major AI crawler (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot…)
 * executes JavaScript, and Googlebot only renders JS on a slower second pass.
 * A client-rendered SPA therefore serves them an empty <div id="root">. This
 * script loads each route in a real browser and snapshots the finished DOM, so
 * every page ships as real HTML.
 *
 * Runs after `vite build`, against the built output. Writes each route as
 * dist/<route>/index.html, which nginx already serves via `try_files $uri $uri/`.
 *
 * Uses a real browser rather than rendering in Node on purpose: components here
 * use ResizeObserver and framer-motion, which need a DOM. This way no component
 * needs changing for prerendering to work.
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, "dist");
const PORT = 4321;

// Keep in sync with the routes in src/App.tsx and public/sitemap.xml.
const ROUTES = [
  "/",
  "/pms",
  "/booking-engine",
  "/channel-manager",
  "/financials",
  "/pos",
  "/automations",
  "/statistics",
  "/stays/hotels",
  "/stays/guesthouses",
  "/stays/vacation-rentals",
  "/stays/glamping",
  "/pricing",
  "/about",
  "/contact",
];

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
  ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain",
};

/** Static server over dist/, falling back to index.html like nginx does. */
function serve() {
  return createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = join(DIST, path);
    if (!existsSync(file) || !extname(file)) file = join(DIST, "index.html");
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}

const server = serve();
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Animations would otherwise keep the page busy and delay the snapshot.
await page.emulateMedia({ reducedMotion: "reduce" });

let failed = 0;

for (const route of ROUTES) {
  try {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
    // The router's meta effect and any lazy chunk must have settled.
    await page.waitForSelector("#root > *", { timeout: 15_000 });

    const html = await page.content();

    // A page whose body is still essentially empty means the snapshot fired too
    // early — shipping that would be worse than shipping nothing, so fail loudly.
    const text = await page.locator("body").innerText();
    if (text.trim().length < 200) throw new Error(`rendered body too short (${text.trim().length} chars)`);

    const outDir = route === "/" ? DIST : join(DIST, route);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), html, "utf8");

    console.log(`  ✓ ${route.padEnd(26)} ${String(text.trim().length).padStart(6)} chars of text`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${route.padEnd(26)} ${error.message}`);
  }
}

await browser.close();
server.close();

if (failed > 0) {
  console.error(`\nPrerender failed for ${failed} route(s). Not shipping a partial build.`);
  process.exit(1);
}
console.log(`\nPrerendered ${ROUTES.length} routes into dist/`);
