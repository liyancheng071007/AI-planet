const api=require('../../services/game');
const {stages}=require('../../lib/content');
Page({
  data:{demo:api.demo,loading:false,error:'',ready:false,items:[],coins:0,completed:0},
  onShow(){this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{
      const {state}=await api.get();
      this.setData({ready:true,coins:state.coins,completed:state.completed.length,items:stages.map((s,i)=>({...s,id:i,number:'0'+(i+1),done:state.completed.includes(i),unlocked:i===0||state.completed.includes(i-1)}))});
    }catch(e){this.setData({error:e.message,ready:false});}
    finally{this.setData({loading:false});}
  },
  open(e){
    const stage=this.data.items[e.currentTarget.dataset.id];
    if(!stage.unlocked)return wx.showModal({title:stage.name,content:stage.desc+' 请先完成前一关。',showCancel:false});
    wx.navigateTo({url:'/pages/mission/index?id='+stage.id});
  },
  onShareAppMessage(){return {title:'AI星球：一起修复智能核心',path:'/pages/home/index'};}
});
