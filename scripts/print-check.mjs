import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {newState} from '../engine.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
try {
 await page.goto('http://127.0.0.1:4173');
 const state=newState();state.completed=[0,1];state.scores={0:100,1:100};state.answers={0:{剔除理由:'模糊数据和错标签会影响训练。'},1:{解释:'新数据有差异，模型能力有局限。'}};
 await page.evaluate(s=>localStorage.setItem('ai-planet-v1',JSON.stringify(s)),state);
 await page.reload();
 await page.locator('.nav-button[data-view="passport"]').click();
 await page.locator('.journal-entry summary').first().click();
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert.equal(await page.locator('.journal-entry[open]').count(),2);
 await page.emulateMedia({media:'print'});
 assert.ok(await page.locator('.badge').first().isVisible());
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.equal(await page.locator('.journal-entry[open]').count(),1);
 console.log('Print QA passed: all records expand, badges remain visible, existing open/closed state restores.');
} finally {await browser.close();}
