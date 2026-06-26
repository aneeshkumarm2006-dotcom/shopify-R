// Places a real order through the prem-tees storefront as an anonymous shopper.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const S = "/s/prem-tees";
const log = (...a) => console.log("  ", ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept().catch(() => {}));
try {
  // 1. product page → pick size M → add to cart
  await page.goto(`${BASE}${S}/products/classic-cotton-crew-tee`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "M", exact: true }).first().click().catch(() => {});
  await page.getByRole("button", { name: /Add to cart/i }).first().click();
  await page.waitForTimeout(1200);
  log("added to cart");

  // 2. cart → checkout
  await page.goto(`${BASE}${S}/cart`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Checkout/i }).first().click().catch(async () => {
    await page.goto(`${BASE}${S}/checkout`, { waitUntil: "domcontentloaded" });
  });
  await page.waitForURL(/\/checkout/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  log("at checkout:", page.url());

  // 3. fill contact + shipping
  await page.getByPlaceholder("you@email.com").fill("shopper@example.com");
  await page.locator('input[autocomplete="given-name"]').fill("Sam");
  await page.locator('input[autocomplete="family-name"]').fill("Shopper");
  await page.getByPlaceholder("Street address").fill("123 Test Ave");
  await page.locator('input[autocomplete="address-level2"]').fill("Portland").catch(() => {});
  await page.locator('input[autocomplete="address-level1"]').fill("OR").catch(() => {});
  await page.locator('input[autocomplete="postal-code"]').fill("97201").catch(() => {});
  await page.getByPlaceholder("(503) 555-0000").fill("5035550000").catch(() => {});

  // 4. choose Cash on delivery
  await page.locator('input[name="settlement"][value="cod"]').check().catch(async () => {
    await page.getByText(/Cash on delivery/i).first().click().catch(() => {});
  });

  // 5. apply discount WELCOME15
  await page.getByPlaceholder("Enter code").fill("WELCOME15").catch(() => {});
  await page.getByRole("button", { name: /^Apply/i }).first().click().catch(() => {});
  await page.waitForTimeout(1000);

  // 6. place order
  await page.getByRole("button", { name: /Place order/i }).first().click();
  const ok = await page.waitForURL(/order-confirmation|confirmation|thank/i, { timeout: 20000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1000);
  log(ok ? "ORDER PLACED → " + page.url() : "order outcome unclear → " + page.url());
  await page.screenshot({ path: "scripts/pw/shots/order-result.png" }).catch(() => {});
} catch (e) {
  console.error("ERR:", e.message);
  await page.screenshot({ path: "scripts/pw/shots/order-error.png" }).catch(() => {});
} finally {
  await browser.close();
}
