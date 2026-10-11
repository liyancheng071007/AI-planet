const api=require('../../services/game');
const {stages}=require('../../lib/content');
Page({
  data:{ready:false,busy:false,error:'',team:'',state:null,award:'',records:[],collaborationLabels:['我们轮换了角色','我们解释并核对了答案','我们讨论了隐私、版权和责任'],modes:['45分钟','90分钟','4课时'],modeIndex:1},
  onShow(){this.load();},
  async load(){
    this.setData({busy:true,error:''});
    try{
      const result=await api.get(),local=api.local();
      this.setData({ready:true,state:result.state,award:result.award,team:local.team,modeIndex:['45','90','project'].indexOf(result.state.mode),records:stages.map((s,id)=>({id,name:s.name,badge:s.badge,done:result.state.completed.includes(id),score:result.state.scores[id]||0,work:local.works[id]?JSON.stringify(local.works[id],null,2):''}))});
    }catch(e){this.setData({error:e.message,ready:false});}
    finally{this.setData({busy:false});}
  },
  team(e){this.setData({team:e.detail.value});},
  mode(e){this.setData({modeIndex:Number(e.detail.value)});},
  collaboration(e){const selected=e.detail.value.map(Number);this.setData({'state.collaborationItems':[0,1,2].map(i=>selected.includes(i))});},
  async save(){
    this.setData({busy:true,error:''});
    try{
      const local=api.local();local.team=this.data.team.trim().slice(0,24)||'星际探索小队';api.saveLocal(local);
      await api.mutate('settings',{mode:['45','90','project'][this.data.modeIndex],collaborationItems:this.data.state.collaborationItems});
      await this.load();wx.showToast({title:'护照已保存'});
    }catch(e){this.setData({error:e.message});}
    finally{this.setData({busy:false});}
  },
  async export(){
    try{const result=await api.get();wx.setClipboardData({data:JSON.stringify({state:result.state,award:result.award,local:api.local()},null,2)});}
    catch(e){this.setData({error:e.message});}
  },
  reset(){this.confirmAction('reset','重新开始？','将清空云端成绩和本机作品，建议先复制护照。');},
  remove(){this.confirmAction('delete','删除云端存档？','删除本账号的云端进度及本机作品。重新打开时将创建空白进度。');},
  confirmAction(action,title,content){
    wx.showModal({title,content,success:async res=>{
      if(!res.confirm)return;
      this.setData({busy:true,error:''});
      try{
        await api.mutate(action,{confirm:true});api.clearLocal();
        if(action==='delete')this.setData({ready:false,state:null,records:[],error:'存档已删除。点击重新读取将创建新进度。'});
        else await this.load();
      }catch(e){this.setData({error:e.message});}
      finally{this.setData({busy:false});}
    }});
  }
});
