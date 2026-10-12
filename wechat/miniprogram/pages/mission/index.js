const api=require('../../services/game');
const {stages}=require('../../lib/content');
const tasks=require('../../lib/tasks');
const journey=require('../../lib/journey');
const {training}=require('../../lib/engine');
Page({
  data:{id:0,stage:{},fields:[],visibleFields:[],step:0,totalSteps:1,stepTitle:'',lastStep:false,busy:false,ready:false,error:'',hint:false,done:false,coins:0,score:0,generatedPrompt:'',art:null,training:null,helpOpen:false,showHint:false,pending:false,focusIndex:-1},
  onLoad(query){
    const id=Number(query.id);
    if(!Number.isInteger(id)||id<0||id>7){this.setData({error:'关卡不存在。'});return;}
    this.setData({id,stage:stages[id],fields:tasks.fields(id),...(api.drafts[id]||{})});
    this.refreshStep();this.load();
  },
  onUnload(){if(!this.data.done)api.drafts[this.data.id]={fields:this.data.fields,step:this.data.step,generatedPrompt:this.data.generatedPrompt,art:this.data.art};},
  refreshStep(callback){
    const steps=journey.steps(this.data.id),step=Math.min(this.data.step,steps.length-1);
    this.setData({step,totalSteps:steps.length,stepTitle:steps[step].title,lastStep:step===steps.length-1,visibleFields:journey.visible(this.data.fields,steps[step]),training:this.data.id===1?training(this.data.fields[0].value):null},callback);
  },
  async load(){
    this.setData({busy:true,error:''});
    try{
      const {state}=await api.get();
      if(this.data.id!==0&&!state.completed.includes(this.data.id-1))throw new Error('请先完成前一关。');
      this.sync(state);this.setData({ready:true,pending:api.hasPending()});
    }catch(e){this.setData({error:e.message});}
    finally{this.setData({busy:false});}
  },
  sync(state){this.setData({coins:state.coins,done:state.completed.includes(this.data.id),score:state.scores[this.data.id]||0,hint:state.hints.includes(this.data.id)||state.skips.includes(this.data.id),assisted:state.skips.includes(this.data.id)});},
  change(e){
    const i=Number(e.currentTarget.dataset.index),field=this.data.fields[i];
    if(!field||this.data.busy||this.data.pending)return;
    let value=e.detail.value;
    if(field.type==='choice'||field.type==='range')value=Number(value);
    if(field.type==='checks')value=value.map(Number);
    if(field.type==='boolean')value=value.length>0;
    this.setData({['fields['+i+'].value']:value,error:'',focusIndex:-1});this.refreshStep();
  },
  help(){this.setData({helpOpen:!this.data.helpOpen});},
  generate(){
    const prompt=this.data.fields[0].value.trim();
    this.setData({generatedPrompt:prompt,art:{cat:prompt.includes('猫'),helmet:prompt.includes('头盔'),mars:prompt.includes('火星')}});
  },
  showIssue(issue){
    const step=journey.steps(this.data.id).findIndex(s=>s.indices.includes(issue.index));
    this.setData({step:Math.max(0,step),error:issue.message,focusIndex:issue.index});
    this.refreshStep(()=>wx.pageScrollTo({selector:'#field-'+issue.index,duration:200}));
  },
  async advance(){
    if(this.data.busy||this.data.pending)return;
    const steps=journey.steps(this.data.id),current=steps[this.data.step];
    const issue=journey.incomplete(this.data.fields,current.indices);
    if(issue)return this.showIssue(issue);
    if(this.data.lastStep)return this.submit();
    if(this.data.id===4)this.generate();
    this.setData({step:this.data.step+1,error:'',focusIndex:-1});this.refreshStep();wx.pageScrollTo({scrollTop:0,duration:200});
  },
  previous(){if(this.data.step>0){this.setData({step:this.data.step-1,error:'',focusIndex:-1});this.refreshStep();wx.pageScrollTo({scrollTop:0,duration:200});}},
  async hint(){
    if(this.data.id===7||this.data.hint){this.setData({showHint:!this.data.showHint});return;}
    if(await this.run('hint',{stage:this.data.id}))this.setData({showHint:true});
  },
  assist(){
    if(this.data.id===7)return this.hint();
    wx.showModal({title:this.data.assisted?'重新填入参考答案？':'辅助解题 · 3枚币',content:this.data.assisted?'会覆盖已有的操作题选择，文字说明会保留。不重复扣币。':'确认后填写操作题参考答案，本关得分为60分。文字说明仍需自己完成。',success:async res=>{
      if(res.confirm&&(this.data.assisted||await this.run('assist',{stage:this.data.id})))this.fillAssist();
    }});
  },
  fillAssist(){this.setData({fields:tasks.assist(this.data.id,this.data.fields),showHint:true});if(this.data.id===4&&this.data.step===1)this.generate();this.refreshStep();},
  async submit(){
    for(const step of journey.steps(this.data.id)){const issue=journey.incomplete(this.data.fields,step.indices);if(issue)return this.showIssue(issue);}
    const answer=tasks.answer(this.data.id,this.data.fields,this.data.generatedPrompt);
    if(await this.run('submit',{stage:this.data.id,answer}))delete api.drafts[this.data.id];
  },
  async run(action,payload){
    if(this.data.busy)return false;
    this.setData({busy:true,error:''});
    try{const result=await api.mutate(action,payload);this.sync(result.state);if(result.localWarning)this.setData({error:result.localWarning});return true;}
    catch(e){this.setData({error:e.message});return false;}
    finally{this.setData({busy:false,pending:api.hasPending()});}
  },
  async retry(){
    this.setData({busy:true,error:''});
    try{const result=await api.retryPending();if(result.deleted){this.setData({ready:false,error:'存档已删除，请重新读取。'});}else{this.sync(result.state);if(this.data.done)delete api.drafts[this.data.id];if(result.localWarning)this.setData({error:result.localWarning});}}
    catch(e){this.setData({error:e.message});}
    finally{this.setData({busy:false,pending:api.hasPending()});}
  },
  next(){if(this.data.id<7)wx.redirectTo({url:'/pages/mission/index?id='+(this.data.id+1)});else wx.switchTab({url:'/pages/passport/index'});}
});
