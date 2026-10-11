const { newState, unlocked, complete, buyHint, buySkip, training, balance, award } = require('./engine');
const { cards, samples } = require('./content');

class GameError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function requireThat(condition, message, code = 'INVALID_INPUT') {
  if (!condition) throw new GameError(code, message);
}
function text(value, min = 8, max = 500) {
  requireThat(typeof value === 'string' && value.trim().length >= min && value.length <= max,
    `文字说明需 ${min}—${max} 个字，请勿填写个人信息。`);
  return value.trim();
}
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const exact = (v, expected) => Array.isArray(v) && v.length === expected.length && v.every((x, i) => x === expected[i]);

// Open answers are checked for completeness, not semantic truth or teaching quality.
// Free text is processed transiently and is not saved in the cloud record.
function validateAnswer(id, a) {
  requireThat(a && typeof a === 'object' && !Array.isArray(a), '请提交完整答案。');
  if (id === 0) {
    requireThat(Array.isArray(a.picks) && a.picks.length === 30 && a.picks.every(v => ['猫','狗','其他','剔除'].includes(v)), '请处理全部30张卡片。');
    let clean = 0, correct = 0, bad = 0;
    cards.forEach((c, i) => {
      if (c.clean && a.picks[i] === c.actual) clean++;
      if (a.picks[i] === (c.clean ? c.actual : '剔除')) correct++;
      if (!c.clean && a.picks[i] !== '剔除') bad++;
    });
    text(a.reason);
    requireThat(clean >= 20 && correct >= 28 && bad === 0, '保留至少20张干净数据，正确处理28张，并剔除全部问题卡片。', 'ANSWER_REJECTED');
    return { clean, correct };
  }
  if (id === 1) {
    text(a.reason);
    requireThat(integer(a.epochs,1,20) && training(a.epochs).test >= 80 && a.choice === 1, '测试准确率需达到80%，并正确解释泛化。', 'ANSWER_REJECTED');
    return { epochs: a.epochs, test: training(a.epochs).test };
  }
  if (id === 2) {
    requireThat(exact(a.judgments, samples.map(s => s.actual === s.predicted ? 0 : 1)) && a.confidence === 1, '请比对真实类别，区分置信度与正确率。', 'ANSWER_REJECTED');
    return { correct: 5 };
  }
  if (id === 3) {
    requireThat(Array.isArray(a.counts) && a.counts.length === 3 && a.counts.every(v => integer(v,0,20)) && balance(a.counts) && a.fairness === 1, '每类至少6张、相差不超过2张，并选择分组测试。', 'ANSWER_REJECTED');
    return { counts: a.counts };
  }
  if (id === 4) {
    const prompt = text(a.prompt,15);
    requireThat(['猫','头盔','卡通','火星'].every(w => prompt.includes(w)) && a.generatedPrompt === prompt, '需包含猫、头盔、卡通、火星，修改后请重新生成。', 'ANSWER_REJECTED');
    // This checks matching input only; it is not proof the client rendered an image.
    return { promptElements: 4, workType: '本地规则模拟' };
  }
  if (id === 5) {
    text(a.evidence);
    requireThat(exact(a.claims, [0,1,1]), '请对照档案，找出两处矛盾。', 'ANSWER_REJECTED');
    return { checked: 3 };
  }
  if (id === 6) {
    ['privacy','copyright','responsibility'].forEach(k => text(a[k]));
    requireThat(Array.isArray(a.selected) && exact([...a.selected].sort(), [1,3,5]), '请选择三项负责任的做法。', 'ANSWER_REJECTED');
    return { rules: 3, teacherReview: true };
  }
  ['problem','sense','think','act','techReason'].forEach(k => text(a[k]));
  requireThat(integer(a.tech,0,3) && a.reviewed === true, '请选择相关技术，并完成展示复盘。');
  return { tech: a.tech, teacherReview: true };
}

function transition(current, event, random = Math.random) {
  const state = JSON.parse(JSON.stringify(current || newState()));
  const { action, payload = {} } = event;
  requireThat(payload && typeof payload === 'object' && !Array.isArray(payload), '参数格式不正确。');
  if (action === 'settings') {
    requireThat(['45','90','project'].includes(payload.mode), '请选择有效课堂节奏。');
    requireThat(Array.isArray(payload.collaborationItems) && payload.collaborationItems.length === 3 && payload.collaborationItems.every(v => typeof v === 'boolean'), '协作自评需三项布尔值。');
    state.mode = payload.mode;
    state.collaborationItems = payload.collaborationItems;
    state.collaboration = payload.collaborationItems.filter(Boolean).length;
  } else if (action === 'reset') {
    requireThat(payload.confirm === true, '请确认重新开始。');
    return newState();
  } else {
    requireThat(['hint','assist','submit'].includes(action), '未知操作。');
    const id = payload.stage;
    requireThat(integer(id,0,7), '关卡编号应为0—7。');
    requireThat(unlocked(state,id), '请先完成前一关。', 'LOCKED');
    if (state.completed.includes(id)) return state;
    if (action === 'hint') {
      if (state.hints.includes(id) || state.skips.includes(id)) return state;
      requireThat(buyHint(state,id), '算力币不足。', 'INSUFFICIENT_COINS');
    } else if (action === 'assist') {
      if (id === 7 || state.skips.includes(id)) return state;
      requireThat(buySkip(state,id), '辅助需要3枚算力币。', 'INSUFFICIENT_COINS');
    } else {
      const summary = validateAnswer(id,payload.answer);
      complete(state,id,state.skips.includes(id) ? 60 : 100,summary,random);
    }
  }
  return state;
}
module.exports = { GameError, requireThat, validateAnswer, transition, newState, award };
