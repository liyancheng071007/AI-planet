// Presentation only; cloud validation remains authoritative.
function steps(id) {
  if(id===0)return [...Array.from({length:6},(_,i)=>({title:`检查第${i*5+1}—${i*5+5}张数据卡`,indices:Array.from({length:5},(_,j)=>i*5+j)})),{title:'说说你的判断',indices:[30]}];
  return [null,
    [{title:'试一试训练轮数',indices:[0]},{title:'解释你观察到的变化',indices:[1,2]}],
    [{title:'检查前三份预测',indices:[0,1,2]},{title:'检查后两份预测',indices:[3,4]},{title:'理解置信度',indices:[5]}],
    [{title:'调整三类数据',indices:[0,1,2]},{title:'选择下一步检查',indices:[3]}],
    [{title:'写清楚你的想象',indices:[0]},{title:'看看你的模拟作品',indices:[]}],
    [{title:'对照资料作判断',indices:[0,1,2]},{title:'记录查证过程',indices:[3]}],
    [{title:'选择负责任的做法',indices:[0]},{title:'写下小队使用公约',indices:[1,2,3]}],
    [{title:'找到一个校园问题',indices:[0]},{title:'设计感知、思考和行动',indices:[1,2,3]},{title:'解释技术并分享方案',indices:[4,5,6]}]
  ][id];
}
function incomplete(fields,indices) {
  for(const index of indices){
    const f=fields[index];
    if(f.type==='text'&&f.value.trim().length<f.min)return {index,message:`「${f.label}」至少写${f.min}个字。`};
    if(f.type==='choice'&&f.value<0)return {index,message:`请完成「${f.label}」的选择。`};
    if(f.type==='checks'&&f.value.length!==3)return {index,message:'请选择三项做法，再进入下一步。'};
    if(f.type==='boolean'&&!f.value)return {index,message:'请先完成展示或口述复盘，再勾选确认。'};
  }
  return null;
}
function visible(fields,step){return step.indices.map(index=>{
  const f=fields[index];
  return {...f,index,choices:(f.options||[]).map((label,value)=>({label,value,checked:f.type==='checks'?f.value.includes(value):f.value===value}))};
});}
function nextStage(completed){const id=Array.from({length:8},(_,i)=>i).find(i=>!completed.includes(i));return id===undefined?8:id;}
function recordLines(answer={}){
  const labels={reason:'我的解释',evidence:'核查记录',prompt:'我的提示词',privacy:'隐私规则',copyright:'版权规则',responsibility:'责任规则',problem:'校园问题',sense:'感知',think:'思考',act:'行动',techReason:'技术作用'};
  return Object.keys(labels).filter(k=>typeof answer[k]==='string'&&answer[k]).map(k=>({label:labels[k],text:answer[k]}));
}
module.exports={steps,incomplete,visible,nextStage,recordLines};
