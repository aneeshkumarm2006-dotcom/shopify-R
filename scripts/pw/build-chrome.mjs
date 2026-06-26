import { chromium } from "playwright";
const BASE="http://localhost:3000";
const log=(...a)=>console.log("  ",...a);
const b=await chromium.launch();const ctx=await b.newContext();const page=await ctx.newPage();
page.on("dialog",d=>d.accept().catch(()=>{}));
try{
  await page.goto(`${BASE}/sign-in`,{waitUntil:"domcontentloaded"});
  await page.fill('input[name="email"]',"prem@davnoot.com");
  await page.fill('input[name="password"]',"PremTees#2026");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/builder`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  // expand Footer group + select node (force past sticky panel)
  await page.locator('.bld-tree-grouphead',{hasText:"Footer"}).click({force:true});
  await page.waitForTimeout(500);
  await page.locator('.bld-treenode',{hasText:"Footer"}).click({force:true});
  await page.waitForTimeout(800);
  await page.getByLabel("Tagline").fill("Premium cotton tees, graphic prints, and everyday essentials — designed to fit right and last. Sizes S–XXL.");
  await page.getByLabel("Legal / compliance text").fill("© 2026 Prem Tees. All rights reserved. Free 30-day exchanges.");
  await page.waitForTimeout(400);
  await page.getByRole("button",{name:/Save draft/i}).click({force:true});
  await page.waitForTimeout(2500);
  log("footer saved");
}catch(e){console.error("ERR:",e.message);await page.screenshot({path:"scripts/pw/shots/footer-err.png"}).catch(()=>{});}
finally{await b.close();}
