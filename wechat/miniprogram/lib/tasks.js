const {cards,samples} = require('./content');
const write = (key,label,min=8) => ({key,label,type:'text',min,value:''});
const choose = (key,label,options) => ({key,label,type:'choice',options,value:-1});
const range = (key,label,value,max=20) => ({key,label,type:'range',value,max});
function fields(id) {
  if (id===0) return [...cards.map(c=>choose('card'+c.id,`#${c.id+1} ${c.icon} 实际：${c.actual} · 标签：${c.label} · ${c.blurry?'模糊':'清晰'}`,['猫','狗','其他','剔除'])),write('reason','剔除理由')];
  if (id===1) return [range('epochs','训练轮数',5),choose('choice','怎样理解泛化？',['训练准确率高就能保证新题全对','新样本有差异，模型也有局限']),write('reason','为什么测试准确率不是100%？')];
  if (id===2) return [...samples.map((s,i)=>choose('sample'+i,`${s.icon} 真实：${s.actual} / 预测：${s.predicted} / 置信度${s.confidence}%`,['预测正确','预测错误'])),choose('confidence','置信度等于正确率吗？',['等于，99%就绝不会错','不等于，需要真实标签和多样本评价'])];
  if (id===3) return [...['白猫','黑猫','花猫'].map((v,i)=>range('cat'+i,v+'数据张数',i===0?18:0)),choose('fairness','修复后还应做什么？',['只检查总体准确率','分别测试各组表现并检查代表性'])];
  if (id===4) return [write('prompt','提示词：猫 + 头盔 + 卡通 + 火星',15)];
  if (id===5) return [...['星球图书馆有120本纸质书。','小蓝能够飞到月球。','温室每天都浇水。'].map((v,i)=>choose('claim'+i,v,['有资料支持','与资料矛盾（幻觉）'])),write('evidence','写出两处矛盾与对应证据')];
  if (id===6) return [{key:'selected',type:'checks',label:'选择三项负责任的做法',value:[],options:['未经告知上传同学人脸','优先用无个人信息素材，必要时先取得适当同意','网上作品可以任意复制','检查授权、记录来源、标注AI参与','错误都由AI承担','由人审核，明确责任人和纠错渠道']},write('privacy','隐私规则'),write('copyright','版权规则'),write('responsibility','责任规则')];
  return [write('problem','校园问题'),write('sense','感知：接收什么信息？'),write('think','思考：怎样分析和规划？'),write('act','行动：做什么，失败时找谁？'),choose('tech','选择相关技术',['AI Agent','世界模型','神经形态计算','具身智能']),write('techReason','技术在方案中发挥什么作用？'),{key:'reviewed',label:'已向伙伴或教师展示，或独立口述复盘',type:'boolean',value:false}];
}
function answer(id,list,generatedPrompt) {
  const v=list.reduce((result,f)=>{result[f.key]=f.value;return result;},{});
  if (id===0) return {picks:cards.map(c=>['猫','狗','其他','剔除'][v['card'+c.id]]),reason:v.reason};
  if (id===1) return v;
  if (id===2) return {judgments:samples.map((_,i)=>v['sample'+i]),confidence:v.confidence};
  if (id===3) return {counts:[v.cat0,v.cat1,v.cat2],fairness:v.fairness};
  if (id===4) return {prompt:v.prompt.trim(),generatedPrompt};
  if (id===5) return {claims:[v.claim0,v.claim1,v.claim2],evidence:v.evidence};
  return v;
}
function assist(id,list) {
  const values={};
  if(id===0) cards.forEach(c=>values['card'+c.id]=c.clean?['猫','狗','其他'].indexOf(c.actual):3);
  if(id===1) Object.assign(values,{epochs:10,choice:1});
  if(id===2) {samples.forEach((s,i)=>values['sample'+i]=s.actual===s.predicted?0:1);values.confidence=1;}
  if(id===3) Object.assign(values,{cat0:8,cat1:8,cat2:8,fairness:1});
  if(id===4) values.prompt='一只戴宇航员头盔的橘猫，卡通风格，在火星上探索。';
  if(id===5) Object.assign(values,{claim0:0,claim1:1,claim2:1});
  if(id===6) values.selected=[1,3,5];
  return list.map(f=>Object.prototype.hasOwnProperty.call(values,f.key)?{...f,value:values[f.key]}:f);
}
module.exports={fields,answer,assist};
