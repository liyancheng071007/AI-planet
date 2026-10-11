import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, restore, unlocked, complete, buyHint, buySkip, training, balance, award } from '../engine.js';
import { cards, stages } from '../content.js';

test('开始时只有第一关解锁，5枚算力币',()=>{const s=newState(); assert.equal(s.coins,5); assert.equal(unlocked(s,0),true); assert.equal(unlocked(s,1),false); assert.equal(complete(s,2),false);});
test('不能重复领取芯片与奖励',()=>{const s=newState(); assert.equal(complete(s,0,100,{clean:22},()=>.9),true); assert.equal(s.coins,7); assert.equal(s.data,22); assert.equal(complete(s,0),false); assert.equal(s.coins,7); assert.equal(unlocked(s,1),true);});
test('提示只扣一次币，锁定关卡不能购买',()=>{const s=newState(); assert.equal(buyHint(s,1),false); assert.equal(buyHint(s,0),true); assert.equal(buyHint(s,0),false); assert.equal(s.coins,4); s.coins=0; s.hints=[]; assert.equal(buyHint(s,0),false);});
test('辅助不会直接发芯片且不能透支',()=>{const s=newState(); assert.equal(buySkip(s,0),true); assert.equal(s.coins,2); assert.equal(s.completed.length,0); assert.equal(buySkip(s,0),false); s.skips=[]; assert.equal(buySkip(s,0),false);});
test('训练模拟体现欠拟合、合理训练和过拟合',()=>{assert.ok(training(3).test<80); assert.ok(training(10).test>=80); assert.equal(training(20).train,100); assert.ok(training(20).test<training(10).test);});
test('公平实验要求足够的样本与均衡覆盖',()=>{assert.equal(balance([0,0,0]),false); assert.equal(balance([18,0,0]),false); assert.equal(balance([6,7,8]),true); assert.equal(balance([6,6,9]),false);});
test('损坏、缺失与旧版本存档恢复为初始状态',()=>{for(const s of ['oops',null,'{}','{"version":2}']) assert.deepEqual(restore(s),newState());});
test('存档去重并过滤非法值',()=>{const s=restore(JSON.stringify({version:1,completed:[0,0,8,-1,'1'],coins:-5,mode:'invalid'})); assert.deepEqual(s.completed,[0]); assert.equal(s.coins,0); assert.equal(s.mode,'90');});
test('完成八关并达到多维要求才能获得金牌',()=>{const s=newState(); for(let i=0;i<8;i++) complete(s,i,100,i===0?{clean:22}:{},()=>.9); assert.equal(award(s),'银牌数据侦探'); s.collaboration=2; assert.equal(award(s),'金牌 AI 训练师'); assert.equal(restore(JSON.stringify(s)).completed.length,8);});
test('故障卡与补给卡可复现',()=>{const s=newState(); complete(s,0,100,{},()=>.1); assert.equal(s.coins,6); complete(s,1,100,{},()=>.3); assert.equal(s.coins,9); assert.equal(s.events.length,2);});
test('内容包含8关与30张数据卡，22张干净数据',()=>{assert.equal(stages.length,8); assert.equal(cards.length,30); assert.equal(cards.filter(c=>c.clean).length,22); assert.equal(cards.filter(c=>c.blurry).length,4);});
test('协作复盘保留具体选项而不是只保留数量',()=>{const s=newState(); s.collaborationItems=[false,false,true]; s.collaboration=1; const restored=restore(JSON.stringify(s)); assert.deepEqual(restored.collaborationItems,[false,false,true]); assert.equal(restored.collaboration,1);});
