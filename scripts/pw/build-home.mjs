// Builds the prem-tees HOME page via the real builder UI: hero + featured products + collection list.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const EMAIL = "prem@davnoot.com", PASSWORD = "PremTees#2026";
const log = (...a) => console.log("  ", ...a);

const FEATURED = [
  "Classic Cotton Crew Tee", "Heavyweight Oversized Tee", "Graphic Sunset Print Tee",
  "Premium Pima Crew Tee", "Vintage Washed Pocket Tee", "Tie-Dye Festival Tee",
  "Striped Breton Long Sleeve", "Performance Athletic Tee",
];
const COLS = [
  ["Best Sellers", "best-sellers"], ["New Arrivals", "new-arrivals"], ["Graphic Tees", "graphic-tees"],
  ["Essentials", "essentials"], ["Oversized", "oversized"], ["Long Sleeve", "long-sleeve"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));
async function shot(n){ await page.screenshot({ path:`scripts/pw/shots/${n}.png` }).catch(()=>{}); }

try {
  // login
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForTimeout(2500);
  log("logged in →", page.url());

  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const addSection = async (label) => {
    await page.getByRole("button", { name: "Add section" }).click();
    await page.waitForTimeout(500);
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: label }).first().click();
    await page.waitForTimeout(800);
  };

  // 1) HERO
  await addSection("Hero");
  await page.getByLabel("Heading").fill("Tees worth living in").catch(() => {});
  await page.getByLabel("Subtext").fill("Premium cotton shirts, bold graphic tees, and everyday essentials — designed to fit right and last. Free exchanges, sizes S–XXL.").catch(() => {});
  await page.getByLabel("Button label").fill("Shop best sellers").catch(() => {});
  await page.getByLabel("Button link").fill("/collections/best-sellers").catch(() => {});
  log("hero added");

  // 2) FEATURED PRODUCTS
  await addSection("Featured products");
  await page.getByLabel("Title").fill("Featured tees").catch(() => {});
  for (const name of FEATURED) {
    await page.getByRole("button", { name: "Add product" }).click().catch(() => {});
    await page.waitForTimeout(250);
    const item = page.getByRole("menuitem", { name }).first();
    if (await item.count()) await item.click(); else await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  log("featured products added");

  // 3) COLLECTION LIST
  await addSection("Collection list");
  await page.getByLabel("Title").fill("Shop by category").catch(() => {});
  for (let i = 0; i < COLS.length; i++) {
    await page.getByRole("button", { name: "Add collection" }).click();
    await page.waitForTimeout(200);
    await page.getByLabel("Collection name").nth(i).fill(COLS[i][0]);
    await page.getByLabel("Collection handle").nth(i).fill(COLS[i][1]);
  }
  log("collection list added");

  // Save
  await page.getByRole("button", { name: /Save draft/i }).click();
  await page.waitForTimeout(2500);
  await shot("builder-final");
  log("saved builder");
} catch (e) {
  console.error("ERR:", e.message);
  await shot("builder-error");
} finally {
  await browser.close();
}
