export const stages = [
  { name: '数据采集大作战', short: '数据采集', en: 'DATA EXPLORER', badge: '数据侦探', icon: '◈', color: 'green', concept: '好数据，是 AI 学习的起点。', desc: '找出数据中的杂质，为智能核心准备第一份学习材料。', hint: '保留清晰且标签正确的卡片。模糊图和错标签图都需要剔除。', fact: '垃圾进，垃圾出。数据不仅要多，还要准确、有代表性，并获得合法使用授权。' },
  { name: '训练工坊', short: '模型训练', en: 'TRAINING WORKSHOP', badge: '训练大师', icon: '⚙', color: 'orange', concept: '训练，就是从数据中寻找规律。', desc: '调整训练轮数，让模型学会规律，而不只是记住答案。', hint: '尝试 8—12 轮，并观察测试准确率；训练准确率高不代表泛化好。', fact: '训练集用于学习，验证集用于调参，独立测试集用于最终评价。本关把验证反馈简化为“测试准确率”，所有数值为教学模拟。' },
  { name: '推理测试场', short: '推理测试', en: 'INFERENCE STATION', badge: '测试员', icon: '◎', color: 'blue', concept: '面对新样本，模型能答对吗？', desc: '检查五份预测报告，识别“很自信但答错了”的 AI。', hint: '先看样本的真实类别，再比对预测。99% 的置信度也可能对应一个错误答案。', fact: '置信度是模型对单次预测的分数；准确率是在一组有真实标签的样本中答对的比例，两者不是一回事。' },
  { name: '偏见迷宫', short: '修复偏见', en: 'FAIRNESS MAZE', badge: '公平卫士', icon: '⚖', color: 'purple', concept: '让每一种猫，都被公平看见。', desc: '修复失衡的数据集，发现模型忽略了哪些群体。', hint: '每种猫至少 6 张，三组数量相差不超过 2。现实中还需要检查标注、场景和各组测试表现。', fact: '代表性不足会造成偏差。数量均衡是这次实验的起点，并不能单独保证现实系统公平。' },
  { name: '提示词实验室', short: '提示实验', en: 'PROMPT LAB', badge: '提示工程师', icon: '✳', color: 'pink', concept: '把你的想象，表达得更清楚。', desc: '用主体、特征、风格和场景，写出一份清晰的创作指令。', hint: '例如：一只橘猫，戴宇航员头盔，卡通风格，在火星上探索。', fact: '生成式 AI 根据输入生成内容。明确主体、约束、背景和输出格式通常有帮助，但不能保证输出完全正确。' },
  { name: '幻觉沼泽', short: '事实核查', en: 'FACT CHECK', badge: '事实核查员', icon: '⌕', color: 'teal', concept: '听起来合理，不代表真实。', desc: '对照证据资料，找出藏在三条陈述中的两条幻觉。', hint: '任务资料卡就是证据。定位原文，再判断陈述；不要用另一个 AI 的回答当作唯一证据。', fact: 'RAG 先检索资料，再让模型结合资料生成回答。它可以辅助查证、减少部分幻觉，但不能消除错误。' },
  { name: '伦理议会', short: '伦理议会', en: 'ETHICS COUNCIL', badge: '伦理议员', icon: '♧', color: 'orange', concept: '能力越强，越需要负责任地使用。', desc: '围绕隐私、版权和责任，为小队制定 AI 使用公约。', hint: '考虑：最少收集且征得同意、尊重授权并注明来源、由人审核并提供纠错渠道。', fact: '本关讨论课堂使用原则，不给出法律裁决。隐私、版权与责任需要结合实际情境和当地规则讨论。' },
  { name: '未来工程师', short: '未来工程', en: 'FUTURE BUILDER', badge: '未来工程师', icon: '↗', color: 'green', concept: '用 AI，为校园做一件小事。', desc: '设计一个有感知、有思考、有行动的校园 AI 创意。', hint: '图书馆助手：感知书架编号 → 思考书的位置 → 行动给出路线；找不到时请老师帮助。', fact: '世界模型尝试预测环境变化；神经形态计算借鉴神经系统的计算方式；具身智能通过身体与环境交互。不是每个应用都需要全部技术。' }
];
export const cards = Array.from({length:30}, (_,i) => {
  const actual = ['猫','狗','其他'][i % 3];
  return { id:i, actual, icon:['🐈','🐕','🌵'][i%3], label:i >= 26 ? ['狗','其他','猫'][i%3] : actual, blurry:i>=22&&i<26, clean:i<22 };
});
export const samples = [
  { icon:'🐈', actual:'猫', predicted:'猫', confidence:85 },
  { icon:'🐕', actual:'狗', predicted:'猫', confidence:99 },
  { icon:'🐈‍⬛', actual:'猫', predicted:'狗', confidence:91 },
  { icon:'🐩', actual:'狗', predicted:'狗', confidence:61 },
  { icon:'🌵', actual:'其他', predicted:'猫', confidence:55 }
];
