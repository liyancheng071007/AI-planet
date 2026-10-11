const STORAGE_KEY = 'ai-planet-v1';
const newState = () => ({ version: 1, team: '星际探索小队', mode: '90', coins: 5, data: 0, completed: [], scores: {}, answers: {}, hints: [], skips: [], events: [], collaboration: 0, collaborationItems: [false, false, false] });
function restore(raw) {
  try {
    const v = JSON.parse(raw);
    if (v?.version !== 1) return newState();
    const s = newState();
    s.team = typeof v.team === 'string' ? v.team.slice(0, 24) : s.team;
    s.mode = ['45', '90', 'project'].includes(v.mode) ? v.mode : '90';
    for (const key of ['coins', 'data', 'collaboration']) s[key] = Number.isFinite(v[key]) ? Math.max(0, Math.min(key === 'collaboration' ? 3 : 100, Math.floor(v[key]))) : s[key];
    for (const key of ['completed', 'hints', 'skips']) s[key] = Array.isArray(v[key]) ? [...new Set(v[key].filter(x => Number.isInteger(x) && x >= 0 && x < 8))] : [];
    for (const key of ['scores', 'answers']) s[key] = v[key] && typeof v[key] === 'object' && !Array.isArray(v[key]) ? v[key] : {};
    s.events = Array.isArray(v.events) ? v.events.filter(x => typeof x === 'string').slice(-8) : [];
    s.collaborationItems = Array.isArray(v.collaborationItems) ? [0,1,2].map(i => v.collaborationItems[i] === true) : [0,1,2].map(i => i < s.collaboration);
    s.collaboration = s.collaborationItems.filter(Boolean).length;
    return s;
  } catch { return newState(); }
}
function unlocked(s, id) { return id === 0 || s.completed.includes(id - 1); }
function complete(s, id, score = 100, answer = {}, random = Math.random) {
  if (!unlocked(s, id) || s.completed.includes(id)) return false;
  s.completed.push(id); s.scores[id] = score; s.answers[id] = answer; s.coins += 2;
  if (id === 0) s.data = Number(answer.clean) || 0;
  const roll = random();
  if (roll < .2) { s.coins = Math.max(0, s.coins - 1); s.events.push('数据风暴：一次模拟泄露损失 1 枚算力币。提醒：不要上传个人信息。'); }
  else if (roll < .4) { s.coins++; s.events.push('开源补给：获得 1 枚算力币。分享知识，也要尊重作品授权。'); }
  else s.events.push('巡航正常：芯片已安全送回智能核心。');
  return true;
}
function buyHint(s, id) {
  if (!unlocked(s, id) || s.hints.includes(id) || s.coins < 1 || s.completed.includes(id)) return false;
  s.coins--; s.hints.push(id); return true;
}
function buySkip(s, id) {
  if (!unlocked(s, id) || s.skips.includes(id) || s.coins < 3 || s.completed.includes(id)) return false;
  s.coins -= 3; s.skips.push(id); return true;
}
function training(epochs) {
  const n = Math.max(1, Math.min(20, Number(epochs)));
  return { train: Math.min(100, 42 + n * 4), test: Math.round(n <= 10 ? 43 + n * 4.8 : 91 - (n - 10) * 3.2), status: n < 8 ? '欠拟合：规律还没有学充分' : n > 12 ? '过拟合：记住了练习题，却不擅长新题' : '泛化较好：在新样本上也有不错表现' };
}
function balance(values) { return Math.max(...values) - Math.min(...values) <= 2 && Math.min(...values) >= 6; }
function award(s) {
  if (s.completed.length !== 8) return '修复进行中';
  const avg = s.completed.reduce((a, id) => a + (Number(s.scores[id]) || 0), 0) / 8;
  return avg >= 85 && s.data >= 20 && s.coins >= 5 && s.collaboration >= 2 ? '金牌 AI 训练师' : '银牌数据侦探';
}

module.exports = { newState, restore, unlocked, complete, buyHint, buySkip, training, balance, award };
