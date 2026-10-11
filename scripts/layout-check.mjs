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
    if(width===390) {
      await page.evaluate(()=>document.activeElement?.blur());
      await page.screenshot({path:'docs/mobile-screenshot.png',fullPage:true});
    }
  }
  await page.locator('.nav-button[data-view="passport"]').click();
  assert.ok(await page.locator('.passport-cover').isVisible());
  assert.equal(await page.locator('.badge').count(),8);
  await page.locator('#team-name').fill('星际研究所');
  await page.locator('#save-team').click();
  assert.ok((await page.locator('.passport-cover').textContent()).includes('星际研究所'));
  await page.screenshot({path:'docs/passport-screenshot.png',fullPage:true,style:'#toast { visibility:hidden; }'});
  await page.locator('.nav-button[data-view="teacher"]').click();
  assert.ok(await page.locator('.guide-cover').isVisible());
  await page.locator('#teacher-mode').selectOption('45');
  assert.equal(await page.locator('#mode').inputValue(),'45');
  await page.evaluate(()=>{window.print=()=>window.__printCalled=true;});
  await page.locator('[data-print]').click();
  assert.equal(await page.evaluate(()=>window.__printCalled),true);
  await page.screenshot({path:'docs/teacher-screenshot.png',fullPage:true,style:'#toast { visibility:hidden; }'});
  for (const screen of ['passport','teacher']) {
    await page.setViewportSize({width:360,height:900});
    await page.locator(`.nav-button[data-view="${screen}"]`).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${screen} overflow at 360`);
  }
  assert.deepEqual(errors,[]);
  console.log('Layout QA passed at 360, 390, 768, 1024 and 1440px; illustrations, navigation and reduced-motion verified.');
}finally{await browser.close();}
