const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tasks=require('../miniprogram/lib/tasks');
const journey=require('../miniprogram/lib/journey');
const {newState,transition}=require('../cloudfunctions/game/domain');
function page(id){
 const file=path.resolve(__dirname,'../miniprogram/pages/mission/index.js');
 let definition,state=newState(),calls=0;
 state.completed=Array.from({length:id},(_,i)=>i);
 const api={drafts:{},hasPending:()=>false,mutate:async(action,payload)=>{calls++;state=transition(state,{action,payload},()=>.8);return {state};}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:p=>definition=p,require:p=>p==='../../services/game'?api:require(path.resolve(path.dirname(file),p)),wx:{pageScrollTo(){},showModal(){}}});
 const p={...definition,data:structuredClone(definition.data),setData(values,callback){for(const [key,value] of Object.entries(values)){
   const parts=key.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;while(parts.length>1)target=target[parts.shift()];target[parts[0]]=value;
 }if(callback)callback();}};
 p.data.id=id;p.data.fields=tasks.fields(id);p.refreshStep();
 return {p,api,calls:()=>calls};
}
function fill(id){return tasks.assist(id,tasks.fields(id)).map(f=>{
 if(f.type==='text'&&f.key!=='prompt')return {...f,value:'我们需要核实数据并说明真实原因'};
 if(f.key==='tech')return {...f,value:0};if(f.key==='reviewed')return {...f,value:true};return f;
});}
test('each field appears in exactly one step; data cards are capped at five',()=>{
 for(let id=0;id<8;id++)assert.deepEqual(journey.steps(id).flatMap(s=>s.indices),tasks.fields(id).map((_,i)=>i));
 assert.ok(journey.steps(0).every(s=>s.indices.length<=5));
 assert.equal(journey.nextStage([]),0);assert.equal(journey.nextStage([0,1]),2);assert.equal(journey.nextStage([0,1,2,3,4,5,6,7]),8);
});
test('all eight page controllers complete guided steps and submit only at the end',async()=>{
 for(let id=0;id<8;id++){
  const {p,calls}=page(id);p.data.fields=fill(id);p.refreshStep();
  while(!p.data.lastStep){await p.advance();assert.equal(calls(),0);}
  await p.advance();assert.equal(calls(),1);assert.equal(p.data.done,true,'stage '+id);
 }
});
test('missing answer stays in its step and never sends a cloud request',async()=>{
 const {p,calls}=page(0);await p.advance();assert.equal(p.data.step,0);assert.equal(p.data.focusIndex,0);assert.equal(calls(),0);
 p.data.fields=fill(0);p.data.fields[30].value='短';p.data.step=6;p.refreshStep();await p.advance();
 assert.equal(p.data.focusIndex,30);assert.equal(calls(),0);
});
test('backtracking preserves inputs and regenerated prompt matches edited text',async()=>{
 const {p}=page(4);p.data.fields=fill(4);p.refreshStep();await p.advance();
 const original=p.data.generatedPrompt;p.previous();assert.equal(p.data.fields[0].value,original);
 p.change({currentTarget:{dataset:{index:0}},detail:{value:original+'，在远处探险'}});await p.advance();
 assert.equal(p.data.generatedPrompt,original+'，在远处探险');assert.notEqual(p.data.generatedPrompt,original);
});
test('returning to the task restores current step and entered answers',()=>{
 const {p,api}=page(0);p.data.fields=fill(0);p.data.step=3;p.onUnload();
 assert.equal(api.drafts[0].step,3);assert.equal(api.drafts[0].fields[0].value,0);
});
test('stage eight help is free and readable records hide internal API fields',async()=>{
 const {p,calls}=page(7);await p.hint();assert.equal(p.data.showHint,true);assert.equal(calls(),0);
 assert.deepEqual(journey.recordLines({reason:'我的发现',picks:['猫'],generatedPrompt:'内部字段'}),[{label:'我的解释',text:'我的发现'}]);
});
test('every native page event is connected to a callable controller method',()=>{
 for(const name of ['home','mission','passport','teacher']){
  const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/index.js');let definition;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:p=>definition=p,require:p=>p==='../../services/game'?{demo:true}:require(path.resolve(path.dirname(file),p))});
  const wxml=fs.readFileSync(file.replace(/\.js$/,'.wxml'),'utf8');
  for(const match of wxml.matchAll(/bind(?:tap|change|input)="([^"]+)"/g))assert.equal(typeof definition[match[1]],'function',name+': '+match[1]);
 }
});
