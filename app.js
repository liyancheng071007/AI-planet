import { newState, restore, STORAGE_KEY, unlocked, complete, buyHint, buySkip, training, balance, award } from './engine.js';
import { stages, cards, samples } from './content.js';
import { scene, heroArt, glyph } from './visuals.js';

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;
let storageAvailable = true;
try { state = restore(localStorage.getItem(STORAGE_KEY)); } catch { state = newState(); storageAvailable = false; }
let view = 'map';
let active = 0;
let toastTimer;
let filter = 'all';
const drafts = new Map();
function toast(message) {
  $('#toast').classList.remove('show');
  $('#dialog-toast').hidden = true;
  const inside = $('#mission-dialog').open;
  const el = inside ? $('#dialog-toast') : $('#toast');
  el.textContent = message; el.hidden = false; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); if (inside) el.hidden = true; }, 6500);
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { storageAvailable = false; toast('浏览器无法保存进度，请在离开前导出护照。'); } }
function answerView(answer) {
  const labels = { clean: '优质数据', 预测: '模型预测' };
  const value = item => Array.isArray(item) ? `<ol class="answer-list">${item.map(v=>`<li>${typeof v==='object' && v!==null ? answerView(v) : escape(v)}</li>`).join('')}</ol>` : item && typeof item==='object' ? answerView(item) : `<span>${escape(item)}</span>`;
  return `<dl class="answer-record">${Object.entries(answer || {}).map(([key,item])=>`<div><dt>${escape(labels[key] || key)}</dt><dd>${value(item)}</dd></div>`).join('')}</dl>`;
}
function updateTaskDetails() {
  $$('.field-counter').forEach(counter => {
    const field = document.getElementById(counter.dataset.for);
    const count = field.value.trim().length;
    counter.innerHTML = `<span>${count>=field.minLength?'✓ 已达到最低字数':`还需 ${field.minLength-count} 字`}</span><span>${count} / ${field.maxLength}</span>`;
    counter.classList.toggle('ready',count>=field.minLength);
  });
  const choices = $$('[data-card]');
  if (choices.length) {
    const filled = choices.filter(el=>el.value).length;
    const discarded = choices.filter(el=>el.value==='剔除').length;
    $('#data-processed').textContent = `${filled} / 30`;
    $('#data-kept').textContent = filled-discarded;
    $('#data-discarded').textContent = discarded;
    $('#data-progress').value = filled;
    $('#next-card').textContent = filled===30 ? '填写剔除理由 ↓' : '定位未处理卡片 ↓';
    choices.forEach(el=>{el.closest('.data-card').classList.toggle('classified',!!el.value);el.closest('.data-card').classList.toggle('discarded',el.value==='剔除');});
  }
  if ($('#prompt-checklist')) {
    const p=$('#prompt').value;
    $('#prompt-checklist').innerHTML = [['猫','主体'],['头盔','特征'],['卡通','风格'],['火星','场景']].map(([word,label])=>`<span class="${p.includes(word)?'checked':''}"><i>${p.includes(word)?'✓':'○'}</i>${label} · ${word}</span>`).join('');
  }
  $$('.dialog-balance').forEach(el=>el.textContent=`✦ ${state.coins} 枚算力币`);
}
function sync() {
  $('#team-label').textContent = state.team;
  $('#mode').value = state.mode;
  $('#progress').value = state.completed.length;
  $('#progress-label').textContent = `${state.completed.length} / 8`;
  $('#stage-list').innerHTML = stages.map((s,i) => `<button class="stage-link ${state.completed.includes(i)?'done':unlocked(state,i)?'current':'upcoming'}" data-stage="${i}" aria-label="${s.name}，${unlocked(state,i)?'进入关卡':'查看预告'}"><span>${state.completed.includes(i)?'✓':String(i+1).padStart(2,'0')}</span>${s.short}<small>${!unlocked(state,i)?'预告':'↗'}</small></button>`).join('');
  $$('.nav-button').forEach(b => b.classList.toggle('active', b.dataset.view===view));
}
function stats() {
  const metrics=[
    {label:'核心芯片',value:state.completed.length,unit:'/ 8',note:state.completed.length===8?'智能核心已修复':'每次发现，都值得收集',icon:0,style:''},
    {label:'算力币',value:state.coins,unit:'枚',note:'提示 1 枚 · 辅助 3 枚',icon:4,style:'coin'},
    {label:'优质数据',value:state.data,unit:'张',note:state.data?'第一关筛选所得':'从第一份干净数据开始',icon:5,style:'data'},
    {label:'任务时长',value:state.mode==='project'?'4':state.mode,unit:state.mode==='project'?'课时':'分钟',note:'按自己的节奏探索',icon:2,style:'time'}
  ];
  return `<div class="stats">${metrics.map(m=>`<div><span class="stat-symbol ${m.style}">${glyph(m.icon)}</span><div><small>${m.label}</small><strong>${m.value}<em>${m.unit}</em></strong><span class="metric-note">${m.note}</span></div></div>`).join('')}</div>`;
}
function render() {
  sync();
  if (view === 'passport') return renderPassport();
  if (view === 'teacher') return renderTeacher();
  const next = stages.findIndex((_,i) => !state.completed.includes(i));
  const selected = stages.map((s,i) => ({...s,i})).filter(s => filter === 'all' || (filter === 'done' ? state.completed.includes(s.i) : unlocked(state,s.i) && !state.completed.includes(s.i)));
  $('#main').innerHTML = `
    <div class="page-heading"><div><span class="eyebrow">MISSION CONTROL / 探索控制中心</span><h2>你好，${escape(state.team)} <span class="wave">✦</span></h2></div><label class="pace-control" for="map-mode"><span>探索节奏</span><select id="map-mode"><option value="45" ${state.mode==='45'?'selected':''}>45 分钟 · 精简</option><option value="90" ${state.mode==='90'?'selected':''}>90 分钟 · 完整</option><option value="project" ${state.mode==='project'?'selected':''}>4 课时 · 项目</option></select></label></div>
    <section class="hero"><div class="hero-copy"><span class="mission-pill"><i></i> 星际任务 #001 <span>·</span> 智能核心修复计划</span><h1>下一站，<br>和 AI 一起<span>探索未来。</span></h1><p>数据风暴打乱了星球的秩序。收集 8 块核心芯片，<br>在一次次实验中，发现 AI 的能力与边界。</p><div class="hero-actions"><button class="primary" ${next<0?'data-view="passport"':`data-stage="${next}"`}>${next<0?'查看修复成果':state.completed.length?'继续我的冒险':'开启星球冒险'} <span>↗</span></button><button class="hero-secondary" data-view="teacher">怎么玩？ <span>▷</span></button></div><div class="next-destination"><span class="destination-dot"></span>${next<0?'所有区域已点亮，去护照回顾你的发现':`下一站 · ${stages[next].name}`}<span>${next<0?'8 / 8':String(next+1).padStart(2,'0')+' / 08'}</span></div><div class="hero-meta"><span>✧ 8 个探索区域</span><span>♧ 1—4 人小队</span><span>◎ 10—15 岁</span></div></div>${heroArt(state.completed.length)}</section>
    ${stats()}
    <section class="expedition-strip"><div class="expedition-title"><span class="eyebrow">YOUR JOURNEY</span><strong>点亮你的探索轨迹</strong><small>每一步，离智能核心更近一点</small></div><div class="journey-nodes">${stages.map((s,i)=>`<button data-stage="${i}" class="journey-node ${state.completed.includes(i)?'done':unlocked(state,i)?'current':''}" aria-label="${s.name}，${unlocked(state,i)?'进入关卡':'查看预告'}"><span>${state.completed.includes(i)?'✓':glyph(i)}</span><small>${String(i+1).padStart(2,'0')}</small><span class="journey-tooltip">${s.short}</span></button>`).join('')}</div></section>
    <section class="map-section"><div class="section-heading"><div><span class="eyebrow">EXPLORE THE UNKNOWN</span><h2>选择你的下一场冒险 <span class="count-label">8 个区域</span></h2></div><div class="filters" aria-label="筛选关卡">${[['all','全部区域'],['ready','可挑战'],['done','已修复']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${filter===id}" class="${filter===id?'selected':''}">${label}</button>`).join('')}</div></div>
    <div class="level-grid">${selected.map(s=>{const i=s.i,done=state.completed.includes(i),lock=!unlocked(state,i); return `<button class="level-card region-${i} ${done?'completed':lock?'locked':'available'}" data-stage="${i}" aria-label="${s.name}，${done?'查看成果':lock?'查看关卡预告':'开始挑战'}"><div class="card-illustration"><span class="level-index">SECTOR ${String(i+1).padStart(2,'0')}</span><span class="card-status">${done?'✓ 已修复':lock?'◷ 可预览':'● 当前任务'}</span>${scene(i)}</div><div class="card-copy"><div class="level-en">${s.en}</div><h3>${s.name}</h3><p>${s.desc}</p><div class="card-tags"><span>${['观察 · 分类','实验 · 调参','预测 · 验证','发现 · 改进','表达 · 创作','查证 · 判断','讨论 · 约定','设计 · 展示'][i]}</span><span>${done?'芯片已归档':'1 枚核心芯片'}</span></div><div class="card-footer"><span>✧ ${s.badge}</span><span class="card-arrow">${done?'回顾':lock?'预览':'出发'} ↗</span></div></div></button>`;}).join('') || `<div class="empty-state"><span>✧</span><h3>${filter==='done'?'这里即将点亮你的第一枚徽章':'所有区域已修复！'}</h3><p>${filter==='done'?'完成一个任务，回来看看你的探索成果。':'前往护照，回顾这段星际旅程。'}</p><button class="secondary" ${filter==='done'?'data-filter="all"':'data-view="passport"'}>${filter==='done'?'查看全部区域':'查看训练师护照'} →</button></div>`}</div></section>
    <section class="bottom-note"><div class="note-icon">✺</div><div><span class="eyebrow">A NOTE FROM PIP</span><strong>好奇心是你的超能力，独立思考是你的指南针。</strong><p>AI 不一定每次都对。大胆提问、寻找证据，下一次就能做得更好。</p></div><button class="secondary" data-view="passport">我的探索护照 ↗</button></section>`;
}
function renderPassport() {
  $('#main').innerHTML = `<span class="eyebrow">MY EXPLORER PASSPORT</span><div class="section-heading"><h1>训练师护照</h1><button class="secondary" id="export">导出探索记录 ↓</button></div><section class="panel"><label for="team-name">小队代号（请勿填写真实姓名）</label><div class="inline-form"><input id="team-name" maxlength="24" value="${escape(state.team)}"><button class="primary" id="save-team">保存代号</button></div><p class="muted">角色分工：数据官 · 训练师 · 测试员 · 伦理官。单人可依次扮演全部角色。</p></section>${stats()}<section class="panel"><h2>${award(state)}</h2><p>${state.completed.length===8?'8 块芯片已归位，智能核心重新点亮！请和伙伴分享最重要的发现。':'每完成一个区域，你的护照就会多一枚徽章。'}</p><div class="badge-grid">${stages.map((s,i)=>`<button class="badge ${state.completed.includes(i)?'earned':''}" data-stage="${i}" aria-label="查看${s.badge}徽章与关卡"><span>${glyph(i)}</span><strong>${s.badge}</strong><small>${state.completed.includes(i)?`${state.scores[i]} 分 · 已收集`: '点击了解任务'}</small></button>`).join('')}</div></section><section class="panel"><h2>团队协作复盘</h2><p class="muted">由小队或教师共同确认；单人模式可按不同角色自评。</p>${['我能倾听并复述伙伴的想法','我能说明自己的证据和推理过程','我能发现风险并主动提出改进'].map((t,i)=>`<label class="check-row"><input type="checkbox" class="collab" ${state.collaborationItems[i]?'checked':''}>${t}</label>`).join('')}<p id="award-note">${state.completed.includes(6)?'✧ 最佳伦理议员：已完成 AI 使用公约。':''}</p></section><section class="panel"><h2>探索记录</h2>${state.completed.map(i=>`<details><summary>${String(i+1).padStart(2,'0')} ${stages[i].name} · ${state.scores[i]} 分${state.skips.includes(i)?' · 使用辅助':''}</summary>${answerView(state.answers[i])}</details>`).join('') || '<p class="muted">还没有完成的关卡，去星球地图开启第一步吧。</p>'}<h3>星际事件</h3>${state.events.map(e=>`<p class="event">${escape(e)}</p>`).join('')||'<p class="muted">星际巡航尚未开始。</p>'}</section><div class="page-actions"><button class="secondary" id="print">打印护照</button><button class="text-button danger" id="reset">重新开始探索</button></div>`;
}
function renderTeacher() {
  $('#main').innerHTML = `<span class="eyebrow">TEACHER'S FIELD GUIDE</span><h1>把好奇心带进课堂。</h1><p class="lead">每一次判断，都比一个正确答案更重要。</p><section class="panel"><h2>选择你的课堂节奏</h2><div class="teacher-grid"><div><h3>45 分钟 · 精简挑战</h3><p>开场 3 分钟 → 每关约 4 分钟 → 分享 10 分钟。保留全部核心概念，口头复盘。</p></div><div><h3>90 分钟 · 完整探索</h3><p>开场 5 分钟 → 每关约 9 分钟 → 分享 13 分钟。轮换团队角色，并解释每次判断。</p></div><div><h3>4 课时 · 项目实践</h3><p>每课时完成 2 关；第 4 课时安排校园 AI 方案展示与同伴反馈。建议每课时 40 分钟。</p></div></div><p class="muted">节奏设置调整教学提示与任务时长，不设置倒计时、不减少关卡；教师可灵活掌握讨论时间。</p></section><section class="panel"><h2>教师引导问题</h2><ol><li>AI 根据什么做出判断？训练数据能代表现实吗？</li><li>为什么数据更多不一定更好？干净的数据是否也可能缺乏代表性？</li><li>模型很有信心时，我们还需要哪些证据？</li><li>AI 出错时，谁应检查、纠正和承担责任？</li><li>像人一样说话，能证明 AI 有意识吗？我们还缺少什么证据？</li></ol></section><section class="panel"><h2>安全与课堂约定</h2><ul><li>不拍人脸，不输入姓名、联系方式、住址等个人信息。</li><li>本游戏不联网调用模型；模型训练、准确率、生成作品均为教学模拟。</li><li>外部 AI 工具由教师使用合适账号并全程陪同，先确认适龄条件与数据规则。</li><li>尊重不同背景，避免用群体刻板印象解释偏见。</li><li>开放题的自动通关只表示材料填写完整，质量由教师或同伴讨论确认。</li></ul></section><section class="panel"><h2>准备与评价</h2><p>线上：每组一台电脑或平板；不插电：30 张数据卡、标签贴、护照、芯片贴纸、算力币与海报纸。</p><p>每关首次完成获得 1 枚芯片和 2 枚算力币。提示花费 1 枚，辅助解题花费 3 枚；重复查看不再发奖。辅助解题后仍需提交作品或概念回答。</p><p>金牌：全部通关、平均分 ≥85、优质数据 ≥20、算力币 ≥5、协作自评 ≥2；其他全部通关者获得银牌。完成伦理议会另获伦理议员称号。</p><button class="secondary" id="print">打印本页</button></section>`;
}
function field(label, id, placeholder = '', min = 8) { return `<label class="input-label" for="${id}">${label}<span class="field-minimum">至少 ${min} 字</span></label><textarea id="${id}" aria-describedby="${id}-counter" minlength="${min}" maxlength="1200" placeholder="${placeholder}" required></textarea><div id="${id}-counter" class="field-counter" data-for="${id}"></div>`; }
function choice(id, options) { return `<select id="${id}" aria-label="${id.startsWith('sample-')?'样本 '+(Number(id.split('-')[1])+1)+' 的预测判断':'选择你的判断'}" required><option value="">请选择</option>${options.map((o,i)=>`<option value="${i}">${o}</option>`).join('')}</select>`; }
function stageBody(id) {
  if (id===0) return `<p>检查 30 张图标数据卡。每张卡选择正确类别，或标记为剔除；保留至少 20 张清晰且标签正确的数据。</p><div class="data-workbench"><div><small>处理进度</small><strong id="data-processed">0 / 30</strong></div><div><small>已保留</small><strong id="data-kept">0</strong></div><div><small>已剔除</small><strong id="data-discarded">0</strong></div><button type="button" class="text-button" id="next-card">定位未处理卡片 ↓</button><progress id="data-progress" max="30" value="0" aria-label="数据处理进度"></progress></div><p class="workbench-note">计数仅记录操作进度，正确性将在提交后核对。</p><div class="data-grid">${cards.map(c=>`<label class="data-card"><small>#${String(c.id+1).padStart(2,'0')} · 标签：${c.label}</small><span class="animal ${c.blurry?'blurred':''}" aria-label="${c.blurry?'模糊的': '清晰的'}${c.actual}图标">${c.icon}</span><small>${c.blurry?'图像模糊':'图像清晰'}</small><select data-card="${c.id}" aria-label="第 ${c.id+1} 张数据卡的处理方式"><option value="">未处理</option>${['猫','狗','其他','剔除'].map(t=>`<option>${t}</option>`).join('')}</select></label>`).join('')}</div>${field('剔除理由','reason','描述模糊数据与错标签会怎样影响模型。')}`;
  if (id===1) return `<div class="notice">教学模拟 · 数值不来自真实模型训练</div><label class="input-label" for="epochs">训练轮数：<strong id="epoch-count">5</strong> 轮</label><input type="range" id="epochs" min="1" max="20" value="5"><div id="training-result"></div><p class="muted">试试 3、10、20 轮。训练越久，测试表现就一定越好吗？</p>${field('为什么测试准确率不是 100%？','reason','从样本差异、信息不足或模型能力解释。')}${choice('train-choice',['训练准确率高就能保证新题全对','新样本与训练数据有差异，模型也有局限'])}`;
  if (id===2) return `<div class="sample-list">${samples.map((s,i)=>`<div class="sample"><span>${s.icon}</span><div><strong>样本 ${i+1} · 真实类别：${s.actual}</strong><p>AI 预测：${s.predicted} · 置信度 ${s.confidence}%</p></div>${choice(`sample-${i}`,['预测正确','预测错误'])}</div>`).join('')}</div><label class="input-label" for="confidence">置信度等于正确率吗？</label>${choice('confidence',['等于，置信度 99% 就绝不会错','不等于，需要真实标签与多样本测试来评价'])}`;
  if (id===3) return `<div class="notice">教学模拟 · 初始训练集只有白猫。本关展示数据覆盖的影响，不代表真实模型必然答错。</div><div class="balance-grid">${['白猫','黑猫','花猫'].map((t,i)=>`<div class="balance-item"><span>${['🐈','🐈‍⬛','🐱'][i]}</span><label for="cat-${i}">${t}数据：<b id="cat-count-${i}">${i===0?18:0}</b> 张</label><input id="cat-${i}" type="range" min="0" max="20" value="${i===0?18:0}"><div class="meter"><i id="cat-bar-${i}"></i></div><small id="cat-accuracy-${i}"></small></div>`).join('')}</div><label class="input-label" for="fairness">修复后，还应该做什么？</label>${choice('fairness',['只检查总体准确率','分别测试各组表现，并持续检查代表性'])}`;
  if (id===4) return `<div class="notice">离线提示词实验 · 输出为规则驱动的本地插画，不调用生成式 AI</div><div class="prompt-example"><p><span>模糊指令</span>画一只猫。</p><p><span>清晰指令</span>画一只戴宇航员头盔的橘猫，卡通风格，火星背景。</p></div>${field('你的提示词','prompt','包含：猫 + 头盔 + 卡通 + 火星。可增加颜色、动作、构图等细节。',15)}<div id="prompt-checklist" class="prompt-checklist" aria-label="提示词要素检查"></div><button type="button" class="secondary" id="generate">生成模拟作品 ✧</button><div id="generation" class="generation empty">你的想象，即将在这里着陆。</div><p class="muted">本关练习清晰表达，需包含“猫、头盔、卡通、火星”四个关键词。系统只检查要素，不评价艺术质量。</p>`;
  if (id===5) return `<div class="evidence"><strong>任务资料卡 · 星球档案 A-07（虚构教学资料）</strong><p>星球图书馆有 120 本纸质书。机器人小蓝只能在室内行走。温室每周三浇水。</p></div><p>对照上方原始资料，判断这份模拟 AI 报告：</p>${['星球图书馆有 120 本纸质书。','机器人小蓝能够飞到月球。','温室每天都浇水。'].map((t,i)=>`<label class="statement">${i+1}. ${t}${choice(`claim-${i}`,['有资料支持','与资料矛盾（幻觉）'])}</label>`).join('')}${field('写出核实过程','evidence','指出至少两处矛盾及原始资料中的对应证据。')}`;
  if (id===6) return `<p>议题：校园 AI 美术展想收集同学照片、模仿画师风格并自动评奖。四个角色分别会担心什么？</p><div class="ethics-options">${['在未告知同学的情况下上传人脸照片','优先使用不含个人信息的素材；确需收集时先征得适当同意','任何网上作品都可以任意复制','检查素材授权并记录来源，清楚标注 AI 参与','所有错误都由 AI 承担责任','由人审核输出，明确负责人并提供纠错渠道'].map((t,i)=>`<label class="check-row"><input type="checkbox" name="ethics" value="${i}">${t}</label>`).join('')}</div>${field('隐私规则','rule-privacy','我们只收集什么？哪些信息不应上传？')}${field('版权规则','rule-copyright','如何尊重原作者与素材授权？')}${field('责任规则','rule-responsibility','谁审核？有错误时如何处理？')}<p class="muted">系统检查选择与填写完整性；公约是否合理，请小队或教师共同评议。</p>`;
  return `<p>为食堂浪费、图书馆找书、校园节水等问题设计一个 AI 应用。</p>${field('校园问题','problem','具体帮助谁解决什么问题？')}${field('感知','sense','它接收哪些信息？避免使用个人信息。')}${field('思考','think','它如何分析信息或规划下一步？')}${field('行动','act','它能做什么？失败时怎样寻求人类帮助？')}<label class="input-label" for="tech">选一项相关技术</label>${choice('tech',['AI Agent：围绕目标规划与执行任务','世界模型：预测环境的变化','神经形态计算：借鉴神经系统的计算方式','具身智能：通过身体与环境交互'])}${field('为什么使用这项技术？','tech-reason','解释它在你的方案里承担的具体作用。')}<label class="check-row"><input id="reviewed" type="checkbox" required>我已向伙伴 / 教师展示，或独立口述复盘方案。</label>`;
}
function rememberDraft() {
  const form = $('#mission-form');
  if (!form) return;
  drafts.set(active, $$('input, select, textarea',form).map(el => ({ key: el.id || el.getAttribute('data-card') || el.name + el.value, value: el.value, checked: el.checked })));
}
function restoreDraft() {
  const draft = drafts.get(active);
  if (!draft) return;
  $$('input, select, textarea', $('#mission-form')).forEach(el => {
    const entry = draft.find(d => d.key === (el.id || el.getAttribute('data-card') || el.name + el.value));
    if (entry) { el.value = entry.value; if (el.type === 'checkbox') el.checked = entry.checked; }
  });
}
function openStage(id) {
  if (!Number.isInteger(id) || !stages[id]) return;
  if ($('#mission-dialog').open) rememberDraft();
  $('#dialog-toast').hidden = true;
  const dialog = $('#mission-dialog');
  dialog.className = `region-${id}`;
  if (!unlocked(state,id)) {
    active = id;
    const s=stages[id], next=stages.findIndex((_,i)=>!state.completed.includes(i));
    $('#dialog-content').innerHTML = `<div class="dialog-header"><span class="eyebrow">SECTOR ${String(id+1).padStart(2,'0')} / 关卡预告</span><button class="close" id="close-dialog" aria-label="关闭关卡">×</button></div><div class="preview-art">${scene(id)}</div><h2 id="dialog-title">${s.name}</h2><p class="lead">${s.concept}</p><p>${s.desc}</p><div class="preview-facts"><div><small>本关徽章</small><strong>✧ ${s.badge}</strong></div><div><small>完成奖励</small><strong>1 枚芯片 + 2 枚算力币</strong></div></div><div class="notice">先完成「${stages[id-1].name}」即可解锁此关。当前可以挑战「${stages[next].name}」。</div><button class="primary" data-stage="${next}">前往当前任务 ↗</button>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $('#close-dialog').focus({preventScroll:true});
    return;
  }
  active = id;
  const s=stages[id], done=state.completed.includes(id);
  $('#dialog-content').innerHTML = `<div class="dialog-header"><span class="eyebrow">LEVEL ${String(id+1).padStart(2,'0')} / ${s.en}</span><button class="close" id="close-dialog" aria-label="关闭关卡">×</button></div><h2 id="dialog-title">${s.name}</h2><p class="lead">${s.concept}</p><div class="task-context"><span class="task-context-icon">${glyph(id)}</span><div><span class="eyebrow">本次探索</span><strong>观察现象 → 动手实验 → 解释你的发现</strong></div><span class="dialog-balance">✦ ${state.coins} 枚算力币</span></div><div class="mission-timing">${state.mode==='45'?'建议 4 分钟 · 完成操作并口头解释':state.mode==='project'?'建议 15 分钟 · 操作、记录并分享':'建议 9 分钟 · 轮换角色并讨论证据'}</div>${done?`<div class="success-panel"><div class="earned-seal"><span>${glyph(id)}</span><i>✓</i></div><span class="eyebrow">MISSION COMPLETE · 探索已完成</span><h3>${s.badge} · 芯片已收集</h3><div class="reward-receipt"><div><small>本关成绩</small><strong>${state.scores[id]} 分</strong></div><div><small>累计芯片</small><strong>${state.completed.length} / 8</strong></div><div><small>当前算力币</small><strong>${state.coins} 枚</strong></div></div>${state.skips.includes(id)?'<p class="assisted-note">本关使用了辅助解题，继续把发现分享给伙伴吧。</p>':''}<p>${s.fact}</p><details class="reflection-details"><summary>查看我的探索记录</summary>${answerView(state.answers[id])}</details><button class="primary" id="next-stage">${id===7?'查看最终成果':'前往下一区域 →'}</button></div>`:`<form id="mission-form">${stageBody(id)}<div class="hint-box" id="hint-box" ${state.hints.includes(id)||state.skips.includes(id)?'':'hidden'}>${s.hint}</div><div id="feedback" role="status" aria-live="polite"></div><div class="mission-actions"><button type="button" class="secondary" id="hint" ${state.hints.includes(id)?'disabled':''}>${state.hints.includes(id)?'提示已解锁':'提示 · 1 币'}</button><button type="button" class="text-button" id="assist" ${state.skips.includes(id)?'disabled':''}>${state.skips.includes(id)?'已使用辅助':'辅助解题 · 3 币'}</button><button class="primary" type="submit">提交修复 ↗</button></div><p class="muted small">辅助解题会填入操作题参考答案；文字作品仍需自己完成，本关最高 60 分。</p></form>`}`;
  if (!$('#mission-dialog').open) $('#mission-dialog').showModal();
  if (!done) {
    $('#mission-form').noValidate = true;
    if (state.skips.includes(id) && !drafts.has(id)) assist(false);
    restoreDraft();
    if (id===1) updateTraining();
    if (id===3) updateBalance();
    $('#mission-form').addEventListener('submit', submit);
    updateTaskDetails();
  }
  dialog.scrollTop = 0;
  $('#close-dialog').focus({preventScroll:true});
}
function updateTraining() {
  const n=Number($('#epochs').value), t=training(n);
  $('#epoch-count').textContent=n;
  $('#training-result').innerHTML = `<div class="training-metrics"><div><small>训练准确率</small><strong>${t.train}%</strong><div class="meter"><i style="width:${t.train}%"></i></div></div><div><small>测试准确率</small><strong>${t.test}%</strong><div class="meter"><i style="width:${t.test}%"></i></div></div></div><p class="notice">${t.status}</p>`;
}
function updateBalance() { for(let i=0;i<3;i++) { const n=Number($(`#cat-${i}`).value); $(`#cat-count-${i}`).textContent=n; $(`#cat-bar-${i}`).style.width=`${Math.min(94,30+n*7)}%`; $(`#cat-accuracy-${i}`).textContent=`模拟组内准确率 ${Math.min(94,30+n*7)}%`; } }
function generate() {
  const p=$('#prompt').value.trim();
  const checks=['猫','头盔','卡通','火星'];
  const missing=checks.filter(t=>!p.includes(t));
  const box=$('#generation'); box.classList.remove('empty');
  box.dataset.prompt=p;
  box.innerHTML=`<div class="generated-art ${p.includes('火星')?'mars':''}"><span class="art-star">✦</span><span class="astronaut ${p.includes('头盔')?'helmet':''}">${p.includes('猫')?'🐈':'✧'}</span><span class="art-planet"></span></div><p>${missing.length?`还缺少：${missing.join('、')}`:'四个要素齐全！插画响应了你的主体、头盔和火星设定。'}</p><small>本地规则模拟 · ${escape(p)}</small>`;
}
function assist(charge=true) {
  if (charge && !buySkip(state,active)) return toast('算力币不足，辅助解题需要 3 枚。');
  $('#hint-box').hidden=false;
  $('#assist').disabled=true; $('#assist').textContent='已使用辅助';
  if (active===0) $$('[data-card]').forEach(el=>{ const c=cards[Number(el.dataset.card)]; el.value=c.clean?c.actual:'剔除'; });
  if (active===1) { $('#epochs').value=10; $('#train-choice').value='1'; updateTraining(); }
  if (active===2) { samples.forEach((s,i)=>$(`#sample-${i}`).value=s.actual===s.predicted?'0':'1'); $('#confidence').value='1'; }
  if (active===3) { for(let i=0;i<3;i++) $(`#cat-${i}`).value=8; $('#fairness').value='1'; updateBalance(); }
  if (active===4) $('#prompt').value='一只戴宇航员头盔的橘猫，卡通风格，正在火星探索。';
  if (active===5) [0,1,1].forEach((x,i)=>$(`#claim-${i}`).value=String(x));
  if (active===6) $$('[name="ethics"]').forEach(el=>el.checked=[1,3,5].includes(Number(el.value)));
  save(); sync(); updateTaskDetails();
}
function submit(event) {
  event.preventDefault();
  const form = $('#mission-form');
  const invalid = $$('[required]',form).find(el => !el.checkValidity() || (el.tagName === 'TEXTAREA' && el.value.trim().length < el.minLength));
  if (invalid) {
    $('#feedback').className='feedback error';
    $('#feedback').textContent = invalid.type === 'checkbox' ? '请先完成展示复盘并勾选确认。' : invalid.tagName === 'TEXTAREA' ? `请完成文字说明，至少输入 ${invalid.minLength} 个字。` : '还有题目没有选择答案，请完成高亮的选项。';
    invalid.setAttribute('aria-invalid','true');
    invalid.focus();
    toast($('#feedback').textContent);
    return;
  }
  const val=id=>$( `#${id}`).value.trim();
  const written=id=>val(id).length>=8;
  let ok=false, answer={}, error='请完成所有操作，并用至少 8 个字解释你的想法。';
  if (active===0) {
    const picks=$$('[data-card]').map(e=>e.value); let clean=0, bad=0, correct=0;
    cards.forEach((c,i)=>{ if(c.clean&&picks[i]===c.actual) clean++; if(!c.clean&&picks[i]!=='剔除') bad++; if(picks[i]===(c.clean?c.actual:'剔除'))correct++; });
    ok=clean>=20&&bad===0&&correct>=28&&picks.every(Boolean)&&written('reason');
    answer={clean,正确处理:correct,剔除理由:val('reason')}; error=`已正确保留 ${clean} 张；尚有 ${bad} 张问题数据未剔除。至少正确处理 28 张，并写出剔除理由。`;
  }
  if (active===1) { const t=training(val('epochs')); ok=t.test>=80&&val('train-choice')==='1'&&written('reason'); answer={训练轮数:val('epochs'),测试准确率:t.test,解释:val('reason')}; error='需要测试准确率达到 80%，选对泛化解释，并写出不是 100% 的原因。'; }
  if (active===2) { ok=samples.every((s,i)=>val(`sample-${i}`)===(s.actual===s.predicted?'0':'1'))&&val('confidence')==='1'; answer={判断:samples.map((s,i)=>({预测:s.predicted,置信度:s.confidence,判断:val(`sample-${i}`)==='0'?'正确':'错误'})),概念:'置信度不等于正确率'}; error='有些判断需要再想想：请对照真实类别，不要只看置信度。'; }
  if (active===3) { const counts=[0,1,2].map(i=>Number(val(`cat-${i}`))); ok=balance(counts)&&val('fairness')==='1'; answer={白猫:counts[0],黑猫:counts[1],花猫:counts[2],后续:'分别测试各组表现'}; error='每类至少 6 张，数量相差不超过 2，并选择后续检查方法。'; }
  if (active===4) { const p=val('prompt'); ok=['猫','头盔','卡通','火星'].every(w=>p.includes(w))&&p.length>=15&&$('#generation').dataset.prompt===p; answer={提示词:p,作品类型:'本地规则模拟插画'}; error='请包含猫、头盔、卡通、火星，并在修改提示词后重新生成作品。'; }
  if (active===5) { ok=[0,1,1].every((x,i)=>val(`claim-${i}`)===String(x))&&written('evidence'); answer={判断:['有资料支持','与资料矛盾','与资料矛盾'],核查记录:val('evidence')}; error='请依据档案找出两处矛盾，核查记录至少写 8 个字；具体证据由同伴或教师复核。'; }
  if (active===6) { const selected=$$('[name="ethics"]:checked').map(e=>Number(e.value)); ok=selected.length===3&&[1,3,5].every(x=>selected.includes(x))&&['rule-privacy','rule-copyright','rule-responsibility'].every(written); answer={隐私:val('rule-privacy'),版权:val('rule-copyright'),责任:val('rule-responsibility'),备注:'公约内容需同伴或教师评议'}; error='请选择三项负责任的做法，并分别写出隐私、版权和责任规则（每项至少 8 字）。'; }
  if (active===7) { ok=['problem','sense','think','act','tech-reason'].every(written)&&val('tech')!==''&&$('#reviewed').checked; answer={问题:val('problem'),感知:val('sense'),思考:val('think'),行动:val('act'),技术:$('#tech').selectedOptions[0].textContent,技术作用:val('tech-reason'),备注:'已自评展示；方案质量需课堂评议'}; }
  if (!ok) { $('#feedback').className='feedback error'; $('#feedback').textContent=error; $('#feedback').scrollIntoView({block:'center'}); return; }
  complete(state,active,state.skips.includes(active)?60:100,answer); save(); render(); openStage(active); toast(`获得「${stages[active].badge}」！${state.events.at(-1)}`);
}
document.addEventListener('click', e=>{
  const v=e.target.closest('[data-view]'); if(v) { e.preventDefault(); view=v.dataset.view; render(); $('#main').focus({preventScroll:true}); window.scrollTo(0,0); }
  const f=e.target.closest('[data-filter]'); if(f) { filter=f.dataset.filter; render(); }
  const s=e.target.closest('[data-stage]'); if(s&&!s.disabled) openStage(Number(s.dataset.stage));
  const b=e.target.closest('button'); if(!b) return;
  if(b.id==='close-dialog') $('#mission-dialog').close();
  if(b.id==='next-stage') { if(active<7) openStage(active+1); else { $('#mission-dialog').close(); view='passport'; render(); } }
  if(b.id==='hint') { if(buyHint(state,active)) { save(); sync(); $('#hint-box').hidden=false; updateTaskDetails(); b.disabled=true; b.textContent='提示已解锁'; } else toast('算力币不足，需要 1 枚。'); }
  if(b.id==='assist') assist();
  if(b.id==='generate') generate();
  if(b.id==='next-card') { const target=$$('[data-card]').find(el=>!el.value)||$('#reason'); target.focus(); target.scrollIntoView({block:'center',behavior:'instant'}); }
  if(b.id==='save-team') { state.team=$('#team-name').value.trim()||'星际探索小队'; save(); sync(); toast('小队代号已保存。'); }
  if(b.id==='export') { const blob=new Blob([JSON.stringify({...state,称号:award(state)},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url; a.download='AI星球-训练师护照.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  if(b.id==='print') window.print();
  if(b.id==='reset'&&window.confirm('重新开始会清空本浏览器中的全部进度。建议先导出护照。确定重新开始吗？')) { state=newState(); drafts.clear(); filter='all'; save(); view='map'; render(); }
});
document.addEventListener('input', e=>{ e.target.removeAttribute('aria-invalid'); if(e.target.id==='epochs') updateTraining(); if(/^cat-\d$/.test(e.target.id)) updateBalance(); if(e.target.closest('#mission-form')) updateTaskDetails(); });
document.addEventListener('change', e=>{
  if(e.target.closest('#mission-form')) updateTaskDetails();
  if(e.target.id==='mode'||e.target.id==='map-mode') { state.mode=e.target.value; save(); render(); toast('探索节奏已更新。'); }
  if(e.target.classList.contains('collab')) { state.collaborationItems=$$('.collab').map(el=>el.checked); state.collaboration=state.collaborationItems.filter(Boolean).length; save(); const focused=$$('.collab').indexOf(e.target); renderPassport(); $$('.collab')[focused]?.focus(); }
});
$('#mission-dialog').addEventListener('close', rememberDraft);
render();
if(!storageAvailable) toast('当前浏览器限制本地存储，离开前请导出护照。');

