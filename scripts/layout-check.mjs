// Focused layout checks, run with the local server active.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173');
  assert.equal(await page.locator('.stats .ui-icon').count(),4);
  assert.equal(await page.locator('.card-tags').count(),8);
  assert.ok((await page.locator('.next-destination').textContent()).includes('数据采集'));
  assert.equal(await page.locator('.hero-svg').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.screenshot({path:'docs/screenshot.png',fullPage:true});
  for (const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow at ${width}`);
    await page.locator('.journey-node').nth(3).click();
    assert.ok(await page.locator('.preview-art').isVisible());
    await page.locator('#close-dialog').click();
    if(width===390) await page.screenshot({path:'docs/mobile-screenshot.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('Layout QA passed at 360, 390, 768, 1024 and 1440px; illustrations, navigation and reduced-motion verified.');
}finally{await browser.close();}
