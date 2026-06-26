// Playwright store builder — drives the REAL admin UI as merchant prem@davnoot.com.
// Usage: node scripts/pw/build-store.mjs <phase>
//   phases: login | settings | collections | products | discounts | publish | all
import { chromium } from "playwright";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PRODUCTS, COLLECTIONS } from "./catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const STATE = join(__dirname, "state.json");
const SHOTS = join(__dirname, "shots");
const SHIRTS_DIR = "/private/tmp/claude-501/-Users-premsaikilaru-Davnoot-Shopify-Clone-shopify-R/983b2167-eb03-4f09-a106-43b26e1636af/scratchpad/shirts";

const BASE = "http://localhost:3000";
const EMAIL = "prem@davnoot.com";
const PASSWORD = "PremTees#2026";
const SUBDOMAIN = "prem-tees";

const phase = process.argv[2] || "all";
const imageFiles = readdirSync(SHIRTS_DIR).filter((f) => f.endsWith(".jpg")).map((f) => join(SHIRTS_DIR, f));

import { existsSync, mkdirSync } from "fs";
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("  ", ...a);

async function shot(page, name) {
  try { await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false }); } catch {}
}

async function login(context, page) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => /\/(dashboard|onboarding)/.test(u.toString()), { timeout: 30000 }).catch(() => {}),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  await page.waitForTimeout(1500);
  const url = page.url();
  log("after login →", url);
  if (/\/onboarding/.test(url)) await onboarding(page);
  await context.storageState({ path: STATE });
  log("session saved");
}

async function onboarding(page) {
  log("onboarding: claiming @" + SUBDOMAIN);
  await page.fill('input[aria-label="Subdomain"]', SUBDOMAIN);
  // wait for availability
  await page.getByText(/Available/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(800);
  // template step — pick "Start from scratch" (blank) for a clean apparel home
  const scratch = page.getByText(/scratch/i).first();
  if (await scratch.isVisible().catch(() => false)) await scratch.click();
  else await page.getByLabel("Store template").locator("button").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /create my store/i }).click();
  await page.waitForURL((u) => !/\/onboarding/.test(u.toString()), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log("onboarding done →", page.url());
}

async function createCollection(page, title) {
  await page.goto(`${BASE}/collections/new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.getByPlaceholder("e.g. Flower").fill(title);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.waitForURL((u) => /\/collections($|\?)/.test(u.toString()), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  log("collection:", title);
}

async function createProduct(page, p, idx) {
  await page.goto(`${BASE}/products/new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // Title
  await page.getByPlaceholder("e.g. Blue Dream · 1g").fill(p.title);
  await page.waitForTimeout(200);

  // Description (rich text contenteditable)
  const editor = page.locator('[contenteditable="true"]').first();
  if (await editor.isVisible().catch(() => false)) { await editor.click(); await editor.type(p.desc, { delay: 0 }); }

  // Media — upload one image via hidden file input
  const img = imageFiles[idx % imageFiles.length];
  await page.locator('input[type="file"]').first().setInputFiles(img);
  // wait for cloudinary thumbnail (img with http src inside dropzone grid)
  await page.locator('.dropzone-grid img, .dropzone-tile img').first().waitFor({ timeout: 45000 }).catch(() => {});
  await page.waitForFunction(() => {
    const im = document.querySelector('.dropzone-grid img, .dropzone-tile img');
    return im && /^https?:/.test(im.getAttribute('src') || '');
  }, { timeout: 45000 }).catch(() => {});

  // Options → Size
  await page.getByRole("button", { name: /Add option/i }).click();
  await page.getByLabel("Option 1 name").fill("Size");
  await page.getByLabel("Option 1 values").fill(p.sizes.join(", "));
  await page.waitForTimeout(500);

  // Per-variant price + qty
  for (const sz of p.sizes) {
    const priceField = page.getByLabel(`Price for ${sz}`, { exact: true });
    if (await priceField.count()) { await priceField.fill(String(p.price)); }
    const qtyField = page.getByLabel(`Quantity for ${sz}`, { exact: true });
    if (await qtyField.count()) { await qtyField.fill(String(p.qty)); }
    if (p.compareAt) { const ca = page.getByLabel(`Compare-at price for ${sz}`, { exact: true }); if (await ca.count()) await ca.fill(String(p.compareAt)); }
  }

  // Product type + vendor
  await page.getByPlaceholder("e.g. Flower, Edibles").fill(p.type);
  await page.getByPlaceholder("e.g. House Brand").fill(p.vendor);

  // Tags
  const tagInput = page.getByLabel("Add a tag");
  for (const t of p.tags) { await tagInput.fill(t); await tagInput.press("Enter"); }

  // Collections membership (Organization card's "Add" = first Add button)
  for (const c of p.collections) {
    await page.getByRole("button", { name: "Add", exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(250);
    const item = page.getByRole("menuitem", { name: c });
    if (await item.count()) await item.first().click();
    await page.waitForTimeout(150);
  }

  // Attributes (Attributes card's "Add" = last Add button)
  for (let i = 0; i < p.attrs.length; i++) {
    await page.getByRole("button", { name: "Add", exact: true }).last().click();
    await page.getByLabel(`Attribute ${i + 1} name`).fill(p.attrs[i][0]);
    await page.getByLabel(`Attribute ${i + 1} value`).fill(p.attrs[i][1]);
  }

  // Status → Active (the select that has an "active" option)
  await page.locator('select:has(option[value="active"])').selectOption("active").catch(() => {});

  // Handle
  await page.getByLabel("Handle").fill(p.handle).catch(() => {});

  // SEO override (meta inputs aren't label-associated → target by placeholder)
  await page.getByRole("button", { name: /SEO override/i }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByPlaceholder(`${p.title} — Store`).fill(p.metaTitle).catch(() => {});
  await page.getByPlaceholder("A short search snippet…").fill(p.metaDesc).catch(() => {});

  // Create
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  const ok = await page.waitForURL((u) => /\/products($|\?)/.test(u.toString()), { timeout: 20000 }).then(() => true).catch(() => false);
  if (!ok) { await shot(page, `fail-${p.handle}`); log("⚠️ product may not have saved:", p.title, "url=", page.url()); }
  else log(`product ${idx + 1}/20:`, p.title);
  await page.waitForTimeout(400);
}

async function setSwitch(page, label, desired) {
  const sw = page.getByRole("switch", { name: label, exact: true }).first();
  if (!(await sw.count())) { log("switch not found:", label); return; }
  const checked = (await sw.getAttribute("aria-checked")) === "true";
  if (checked !== desired) await sw.click();
}

async function settings(page) {
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await setSwitch(page, "Enable age gate", false);     // shirts — no 21+ gate
  await setSwitch(page, "Online payment", true);
  await setSwitch(page, "Cash on delivery", true);
  // SEO defaults (best-effort; Field labels may not associate)
  await page.getByLabel("Default meta title").fill("Prem Tees — Premium Shirts & Graphic Tees").catch(() => {});
  await page.getByLabel("Default meta description").fill("Shop premium shirts, graphic tees, and everyday essentials at Prem Tees. Soft cotton, bold prints, sizes S–XXL.").catch(() => {});
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.waitForTimeout(1800);
  log("settings saved (age-gate off, online+COD on)");
}

async function makeDiscounts(page) {
  const codes = [
    { code: "WELCOME15", type: "percentage", value: "15" },
    { code: "SUMMER20", type: "percentage", value: "20" },
    { code: "TENOFF", type: "fixed", value: "10" },
  ];
  for (const d of codes) {
    await page.goto(`${BASE}/discounts`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "Create discount" }).first().click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("SUMMER20").fill(d.code);
    await page.locator('select:has(option[value="percentage"])').selectOption(d.type).catch(() => {});
    await page.locator('input[type="number"]').first().fill(d.value);
    await page.getByRole("button", { name: "Create discount" }).last().click();
    await page.waitForTimeout(1200);
    log("discount:", d.code);
  }
}

async function fixSeo(page) {
  await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const link = page.getByText("Classic Cotton Crew Tee", { exact: true }).first();
  if (!(await link.count())) { log("product 1 not found for SEO fix"); return; }
  await link.click();
  await page.waitForURL(/\/products\/edit\//, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /SEO override/i }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByPlaceholder("Classic Cotton Crew Tee — Store").fill("Classic Cotton Crew Tee — Soft 100% Cotton T-Shirt").catch(() => {});
  await page.getByPlaceholder("A short search snippet…").fill("Shop our Classic Cotton Crew Tee in soft 100% combed cotton. Regular fit, everyday comfort. Sizes S–XXL.").catch(() => {});
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.waitForTimeout(1500);
  log("product 1 SEO backfilled");
}

async function publish(page) {
  await page.goto(`${BASE}/publish`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Publish store" }).first().click();
  await page.waitForTimeout(600);
  // confirm inside the dialog
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Publish store" }).click().catch(async () => {
    await page.getByRole("button", { name: "Publish store" }).last().click().catch(() => {});
  });
  await page.waitForTimeout(2000);
  log("publish confirmed");
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext(existsSync(STATE) && phase !== "login" ? { storageState: STATE } : {});
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));

  try {
    if (phase === "login" || phase === "all") await login(context, page);
    else { // ensure logged in for other phases
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      if (/\/sign-in/.test(page.url())) await login(context, page);
    }

    if (phase === "collections" || phase === "all") {
      log("=== collections ===");
      for (const c of COLLECTIONS) await createCollection(page, c);
    }
    if (phase === "products" || phase === "all") {
      log("=== products ===");
      const limit = process.env.LIMIT ? Number(process.env.LIMIT) : PRODUCTS.length;
      const start = process.env.START ? Number(process.env.START) : 0;
      for (let i = start; i < Math.min(PRODUCTS.length, start + limit); i++) await createProduct(page, PRODUCTS[i], i);
    }
    if (phase === "settings" || phase === "all") { log("=== settings ==="); await settings(page); }
    if (phase === "seo" || phase === "all") { log("=== seo fix ==="); await fixSeo(page); }
    if (phase === "discounts" || phase === "all") { log("=== discounts ==="); await makeDiscounts(page); }
    if (phase === "publish" || phase === "all") { log("=== publish ==="); await publish(page); }
    log("PHASE DONE:", phase);
  } catch (e) {
    await shot(page, "fatal");
    console.error("FATAL:", e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
run();
