const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,userKey}=require('../cloudfunctions/game/service');
const {cards}=require('../cloudfunctions/game/content');
const {validateAnswer}=require('../cloudfunctions/game/domain');
const text='数据需要核实并由教师共同评议';
const answers=[
  {picks:cards.map(c=>c.clean?c.actual:'剔除'),reason:text},
  {epochs:10,choice:1,reason:text},
  {judgments:[0,1,1,0,1],confidence:1},
  {counts:[8,8,8],fairness:1},
  {prompt:'一只戴宇航员头盔的橘猫，卡通风格，在火星探索',generatedPrompt:'一只戴宇航员头盔的橘猫，卡通风格，在火星探索'},
  {claims:[0,1,1],evidence:text},
  {selected:[1,3,5],privacy:text,copyright:text,responsibility:text},
  {problem:text,sense:text,think:text,act:text,techReason:text,tech:0,reviewed:true}
];
function setup(){
  const records=new Map();let tail=Promise.resolve(),serial=0;
  const store={atomic(key,change){const run=tail.then(()=>{const result=change(structuredClone(records.get(key)||null));if(result.record)records.set(key,structuredClone(result.record));else records.delete(key);return structuredClone(result.response);});tail=run.catch(()=>{});return run;}};
  const service=createService(store,()=>.8),context={APPID:'wx-test',OPENID:'student-A'};
  const request=(action,payload={},expectedRevision=0)=>({action,payload,expectedRevision,requestId:'request_00000000_'+(++serial)});
  return {records,service,context,request};
}
test('all eight stages award only server-calculated scores and retain no free text',async()=>{
 const {service,context,request,records}=setup();let result=await service({action:'get'},context);
 for(let i=0;i<8;i++){
  result=await service(request('submit',{stage:i,answer:answers[i],score:999,coins:999},result.revision),context);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.state.scores[i],100);
 }
 assert.equal(result.state.coins,21);assert.equal(result.state.completed.length,8);
 result=await service(request('settings',{mode:'90',collaborationItems:[true,true,false]},result.revision),context);
 assert.equal(result.award,'金牌 AI 训练师');
 assert.ok(!JSON.stringify([...records.values()]).includes(text));
});
test('identity isolation and client identity injection',async()=>{
 const {service,context,request}=setup();
 assert.equal((await service({action:'get'},{})).code,'UNAUTHENTICATED');
 await service(request('hint',{stage:0}),context);
 const other=await service({action:'get',OPENID:context.OPENID,userId:userKey(context)},{...context,OPENID:'student-B'});
 assert.equal(other.state.coins,5);
});
test('duplicate requests and concurrent calls cannot double-charge',async()=>{
 const {service,context,request}=setup();const event=request('assist',{stage:0});
 const results=await Promise.all([service(event,context),service(event,context)]);
 assert.equal(results[0].state.coins,2);assert.equal(results[1].state.coins,2);assert.equal(results[1].replay,true);
 assert.equal((await service({...event,payload:{stage:1}},context)).code,'REQUEST_REUSED');
});
test('conflict and stale revisions preserve authoritative state',async()=>{
 const {service,context,request}=setup();await service(request('hint',{stage:0}),context);
 assert.equal((await service(request('assist',{stage:0}),context)).code,'CONFLICT');
 assert.equal((await service({action:'get'},context)).state.coins,4);
});
test('lock, insufficient funds, assisted score and free stage eight structure',async()=>{
 const {service,context,request}=setup();
 assert.equal((await service(request('submit',{stage:7,answer:answers[7]}),context)).code,'LOCKED');
 let r=await service(request('assist',{stage:0}),context);
 r=await service(request('submit',{stage:0,answer:answers[0]},r.revision),context);assert.equal(r.state.scores[0],60);
 r=await service(request('assist',{stage:1},r.revision),context);
 r=await service(request('hint',{stage:1},r.revision),context);assert.equal(r.state.coins,1);
 r=await service(request('submit',{stage:1,answer:answers[1]},r.revision),context);
 r=await service(request('hint',{stage:2},r.revision),context);
 assert.equal((await service(request('assist',{stage:2},r.revision),context)).code,'INSUFFICIENT_COINS');
 for(let i=2;i<7;i++)r=await service(request('submit',{stage:i,answer:answers[i]},r.revision),context);
 const coins=r.state.coins;r=await service(request('assist',{stage:7},r.revision),context);assert.equal(r.state.coins,coins);
});
test('bad data, out-of-range numbers, stale art, oversized and missing fields rejected',()=>{
 const bad=[{...answers[0],picks:Array(30).fill('猫')},{...answers[1],epochs:NaN},{...answers[2],confidence:0},{...answers[3],counts:[8,8,Infinity]},{...answers[4],generatedPrompt:'old'},{...answers[5],claims:[1,1,1]},{...answers[6],selected:[1,1,5]},{...answers[7],tech:99}];
 bad.forEach((a,i)=>assert.throws(()=>validateAnswer(i,a)));
 assert.throws(()=>validateAnswer(1,{...answers[1],reason:'a'.repeat(501)}));
});
test('reset requires confirmation and delete removes record',async()=>{
 const {service,context,request,records}=setup();
 await service({action:'get'},context);
 assert.equal((await service(request('reset'),context)).code,'INVALID_INPUT');
 assert.equal((await service(request('delete',{confirm:true}),context)).deleted,true);
 assert.equal(records.size,0);
});
test('provider failure is not exposed or replaced with success',async()=>{
 const service=createService({atomic(){throw Error('SECRET_PROVIDER_DETAILS');}});
 const result=await service({action:'get'},{APPID:'wx',OPENID:'user'});
 assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.ok(!JSON.stringify(result).includes('SECRET'));
});
module.exports={answers};
