const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const tasks=require('../miniprogram/lib/tasks');
const {validateAnswer}=require('../cloudfunctions/game/domain');
const file=path.resolve(__dirname,'../miniprogram/services/game.js');
function client(demo,handler){
 const cache=new Map(),exports={};
 const sandbox={module:{exports},getApp:()=>({globalData:{cloudReady:true}}),wx:{getStorageSync:k=>cache.get(k),setStorageSync:(k,v)=>cache.set(k,v),removeStorageSync:k=>cache.delete(k),cloud:{callFunction:handler}},require:p=>p==='../config'?{demo,envId:'test'}:require(path.resolve(path.dirname(file),p))};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
 return sandbox.module.exports;
}
test('native form schemas and assistance produce valid eight-stage API payloads',()=>{
 for(let id=0;id<8;id++){
  let fields=tasks.assist(id,tasks.fields(id));
  fields=fields.map(f=>f.type==='text'&&f.key!=='prompt'?{...f,value:'由教师审核数据并讨论原因'}:f);
  if(id===7)fields=fields.map(f=>f.key==='tech'?{...f,value:0}:f.key==='reviewed'?{...f,value:true}:f);
  const prompt=fields.find(f=>f.key==='prompt');
  assert.doesNotThrow(()=>validateAnswer(id,tasks.answer(id,fields,prompt&&prompt.value)));
 }
});
test('unregistered demo runs locally without invoking cloud',async()=>{
 const api=client(true,()=>{throw Error('cloud must not be called');});
 assert.equal((await api.get()).state.coins,5);
 assert.equal((await api.mutate('hint',{stage:0})).state.coins,4);
 assert.equal((await api.mutate('hint',{stage:0})).state.coins,4);
});
test('network retry reuses request ID and cloud mode never silently falls back',async()=>{
 const events=[];let first=true;
 const api=client(false,async({data})=>{
  events.push(data);
  if(data.action==='get')return {result:{ok:true,revision:0,state:{coins:5}}};
  if(first){first=false;throw Error('Network failure');}
  return {result:{ok:true,revision:1,state:{coins:4}}};
 });
 await api.get();await assert.rejects(api.mutate('hint',{stage:0}));
 assert.equal((await api.mutate('hint',{stage:0})).state.coins,4);
 assert.equal(events[1].requestId,events[2].requestId);
});
test('conflict refreshes state and unlocks a fresh retry',async()=>{
 let conflict=true,revision=0;
 const api=client(false,async({data})=>{
  if(data.action==='get')return {result:{ok:true,revision:revision++,state:{coins:4}}};
  if(conflict){conflict=false;return {result:{ok:false,code:'CONFLICT',message:'refresh'}};}
  assert.equal(data.expectedRevision,1);
  return {result:{ok:true,revision:2,state:{coins:3}}};
 });
 await api.get();await assert.rejects(api.mutate('hint',{stage:0}));
 assert.equal((await api.mutate('hint',{stage:0})).state.coins,3);
});
test('demo validation failure allows correction instead of locking all future actions',async()=>{
 const api=client(true,()=>{throw Error('must stay local');});
 await api.get();await assert.rejects(api.mutate('submit',{stage:0,answer:{}}));
 assert.equal(api.hasPending(),false);
 assert.equal((await api.mutate('hint',{stage:0})).state.coins,4);
});
test('explicit retry recovers original payload even if the form has changed',async()=>{
 const sent=[];let failure=true;
 const api=client(false,async({data})=>{
  if(data.action==='get')return {result:{ok:true,revision:0,state:{coins:5}}};
  sent.push(data);
  if(failure){failure=false;throw Error('lost response');}
  return {result:{ok:true,revision:1,state:{coins:7}}};
 });
 await api.get();await assert.rejects(api.mutate('submit',{stage:0,answer:{reason:'original writing'}}));
 assert.equal(api.hasPending(),true);
 await assert.rejects(api.mutate('submit',{stage:0,answer:{reason:'changed writing'}}));
 await api.retryPending();assert.equal(api.hasPending(),false);
 assert.equal(sent[0].requestId,sent[1].requestId);
 assert.equal(api.local().works[0].reason,'original writing');
});
