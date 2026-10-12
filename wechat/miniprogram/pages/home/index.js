const api=require('../../services/game');
const {stages}=require('../../lib/content');
const {nextStage}=require('../../lib/journey');
Page({
  data:{demo:api.demo,loading:false,error:'',ready:false,items:[],coins:0,completed:0,expanded:false,current:0,currentName:''},
  onShow(){this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{
      const {state}=await api.get();
      const current=nextStage(state.completed);this.setData({current,currentName:current<8?stages[current].name:'智能核心已修复'});
      this.setData({ready:true,coins:state.coins,completed:state.completed.length,items:stages.map((s,i)=>({...s,id:i,number:'0'+(i+1),done:state.completed.includes(i),unlocked:i===0||state.completed.includes(i-1)}))});
    }catch(e){this.setData({error:e.message,ready:false});}
    finally{this.setData({loading:false});}
  },
  continue(){if(this.data.current===8)wx.switchTab({url:'/pages/passport/index'});else wx.navigateTo({url:'/pages/mission/index?id='+this.data.current});},
  toggle(){this.setData({expanded:!this.data.expanded});},
  open(e){
    const stage=this.data.items[e.currentTarget.dataset.id];
    if(!stage)return;
    if(!stage.unlocked)return wx.showModal({title:stage.name,content:stage.desc+' 完成当前任务后即可逐步解锁。',confirmText:'去当前关',cancelText:'稍后再看',success:res=>{if(res.confirm)this.continue();}});
    wx.navigateTo({url:'/pages/mission/index?id='+stage.id});
  },
  onShareAppMessage(){return {title:'AI星球：一起修复智能核心',path:'/pages/home/index'};}
});
