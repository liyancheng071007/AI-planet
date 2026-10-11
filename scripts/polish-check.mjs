// Focused browser checks for the visual refinement rounds; npm start must be running.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { newState } from '../engine.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function seed(state) {
  await page.evaluate(s=>localStorage.setItem('ai-planet-v1',JSON.stringify(s)),state);
  await page.reload();
}
try {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('.level-card').first().click();
  assert.equal(await page.locator('#data-processed').textContent(),'0 / 30');
  await page.locator('[data-card="0"]').selectOption('猫');
  assert.equal(await page.locator('#data-processed').textContent(),'1 / 30');
  await page.locator('#next-card').click();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),'1');
  await page.locator('#reason').fill('图像不清晰与错标签都会影响训练。');
  assert.ok(await page.locator('.field-counter.ready').count());
  await page.locator('#assist').click();
  assert.equal(await page.locator('#data-processed').textContent(),'30 / 30');
  assert.equal(await page.locator('#data-discarded').textContent(),'8');
  assert.ok((await page.locator('.dialog-balance').textContent()).includes('2 枚'));
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('.earned-seal').count(),1);
  assert.equal(await page.locator('.reward-receipt').count(),1);
  await page.locator('.reflection-details summary').click();
  assert.ok((await page.locator('.answer-record').textContent()).includes('剔除理由'));
  await page.screenshot({path:'docs/reward-screenshot.png'});
  const s=newState();s.completed=[0,1,2,3];
  await seed(s);
  await page.locator('.level-card').nth(4).click();
  assert.equal(await page.locator('#prompt-checklist .checked').count(),0);
  await page.locator('#prompt').fill('画一只戴宇航员头盔的猫，卡通风格，火星背景。');
  assert.equal(await page.locator('#prompt-checklist .checked').count(),4);
  await page.locator('#generate').click();
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('.earned-seal').count(),1);
  await page.locator('#close-dialog').click();
  await page.locator('.nav-button[data-view="passport"]').click();
  await page.locator('.badge').nth(6).click();
  assert.ok((await page.locator('#dialog-content').textContent()).includes('关卡预告'));
  assert.deepEqual(errors,[]);
  console.log('Polish QA passed: live task counts, focus shortcut, writing feedback, live wallet, rewards, readable records, prompt checklist, badge navigation.');
} finally {await browser.close();}
