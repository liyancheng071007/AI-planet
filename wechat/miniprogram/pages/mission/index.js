const api=require('../../services/game');
const {stages}=require('../../lib/content');
const tasks=require('../../lib/tasks');
const {training}=require('../../lib/engine');
Page({
  data:{id:0,stage:{},fields:[],busy:false,ready:false,error:'',hint:false,done:false,coins:0,score:0,generatedPrompt:'',art:null,training:null},
  onLoad(query){
    const id=Number(query.id);
    if(!Number.isInteger(id)||id<0||id>7){this.setData({error:'关卡不存在。'});return;}
    this.setData({id,stage:stages[id],fields:tasks.fields(id),...(api.drafts[id]||{})});
    this.load();
  },
  onUnload(){if(!this.data.done)api.drafts[this.data.id]={fields:this.data.fields,generatedPrompt:this.data.generatedPrompt,art:this.data.art};},
  async load(){
    this.setData({busy:true,error:''});
    try{
      const {state}=await api.get();
      if(this.data.id!==0&&!state.completed.includes(this.data.id-1))throw new Error('请先完成前一关。');
      this.sync(state);this.setData({ready:true});this.updateTraining();
    }catch(e){this.setData({error:e.message});}
    finally{this.setData({busy:false});}
  },
  sync(state){this.setData({coins:state.coins,done:state.completed.includes(this.data.id),score:state.scores[this.data.id]||0,hint:state.hints.includes(this.data.id)||state.skips.includes(this.data.id),assisted:state.skips.includes(this.data.id)});},
  change(e){
    const i=Number(e.currentTarget.dataset.index),field=this.data.fields[i];
    let value=e.detail.value;
    if(field.type==='choice'||field.type==='range')value=Number(value);
    if(field.type==='checks')value=value.map(Number);
    if(field.type==='boolean')value=value.length>0;
    this.setData({['fields['+i+'].value']:value,error:''});
    this.updateTraining();
  },
  updateTraining(){if(this.data.id===1)this.setData({training:training(this.data.fields[0].value)});},
  generate(){
    const prompt=this.data.fields[0].value.trim();
    if(!prompt)return this.setData({error:'请先填写提示词。'});
    this.setData({generatedPrompt:prompt,art:{cat:prompt.includes('猫'),helmet:prompt.includes('头盔'),mars:prompt.includes('火星')}});
  },
  async hint(){
    if(this.data.hint){this.setData({showHint:!this.data.showHint});return;}
    await this.run('hint',{stage:this.data.id});
    if(this.data.hint)this.setData({showHint:true});
  },
  assist(){
    if(this.data.id===7){this.setData({showHint:!this.data.showHint});return;}
    if(this.data.assisted)return this.fillAssist();
    wx.showModal({title:'辅助解题 · 3枚币',content:'确认后填写操作题参考答案，本关得分为60分。文字说明仍需自己完成。',success:async res=>{
      if(res.confirm&&await this.run('assist',{stage:this.data.id}))this.fillAssist();
    }});
  },
  fillAssist(){this.setData({fields:tasks.assist(this.data.id,this.data.fields),showHint:true});this.updateTraining();},
  async submit(){
    const answer=tasks.answer(this.data.id,this.data.fields,this.data.generatedPrompt);
    if(await this.run('submit',{stage:this.data.id,answer})){
      delete api.drafts[this.data.id];
      try{api.saveWork(this.data.id,answer);}catch(e){wx.showModal({title:'云端成绩已保存',content:'本机作品保存失败，可能是存储空间不足。',showCancel:false});}
    }
  },
  async run(action,payload){
    if(this.data.busy)return false;
    this.setData({busy:true,error:''});
    try{const result=await api.mutate(action,payload);this.sync(result.state);return true;}
    catch(e){this.setData({error:e.message});return false;}
    finally{this.setData({busy:false});}
  },
  next(){if(this.data.id<7)wx.redirectTo({url:'/pages/mission/index?id='+(this.data.id+1)});else wx.switchTab({url:'/pages/passport/index'});}
});
