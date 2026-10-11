import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:4173');
 assert.equal(await page.locator('.skip-link').evaluate(el=>getComputedStyle(el).clipPath),'inset(50%)');
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');
 assert.equal(await page.locator('.skip-link').evaluate(el=>getComputedStyle(el).clipPath),'none');
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
 await page.locator('.level-card').first().focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'close-dialog');
 for(let i=0;i<12;i++) {
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),true);
 }
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('level-card')),true);
 await page.locator('.level-card').first().click();
 await page.locator('button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'reason');
 await page.locator('#reason').fill('键盘和手机都能清楚看到输入焦点与字数。');
 await page.locator('#close-dialog').click();
 await page.locator('.level-card').first().click();
 assert.equal(await page.locator('#reason').inputValue(),'键盘和手机都能清楚看到输入焦点与字数。');
 for(const selector of ['#close-dialog','button[type="submit"]','#hint']) {
   assert.ok((await page.locator(selector).boundingBox()).height>=44);
 }
 await page.locator('#close-dialog').click();
 await page.evaluate(()=>document.activeElement.blur());
 await page.screenshot({path:'docs/mobile-screenshot.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Keyboard, skip link, modal focus containment/return, validation focus, draft recovery and 44px task controls passed.');
}finally{await browser.close();}
