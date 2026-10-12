const config = require('../config');
const { newState, transition, award } = require('../lib/domain');
const DEMO_KEY = 'ai-planet-wx-demo-v1';
const LOCAL_KEY = 'ai-planet-wx-works-' + (config.demo ? 'demo' : config.envId);
let snapshot = null;
let busy = false;
let pending = null;
const drafts = {};
function saveLocal(value) { wx.setStorageSync(LOCAL_KEY,value); }
function local() { return wx.getStorageSync(LOCAL_KEY) || {team:'星际探索小队',works:{}}; }
function requestId() { return 'wx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
async function invoke(event) {
  if (config.demo) {
    const record = wx.getStorageSync(DEMO_KEY) || {revision:0,state:newState()};
    if (event.action === 'delete') { wx.removeStorageSync(DEMO_KEY); return {ok:true,deleted:true}; }
    if (event.action !== 'get') {
      record.state = transition(record.state,event);
      record.revision++;
      wx.setStorageSync(DEMO_KEY,record);
    }
    return {ok:true,...record,award:award(record.state)};
  }
  if (!getApp().globalData.cloudReady) throw new Error('尚未配置云环境，请填写 AppID、envId 并部署云函数。');
  const res = await wx.cloud.callFunction({name:'game',data:event});
  return res.result;
}
async function get() {
  const result = await invoke({action:'get'});
  if (!result || !result.ok) throw new Error(result && result.message || '无法读取存档。');
  snapshot = result;
  return result;
}
async function mutate(action,payload) {
  if (busy) throw new Error('正在保存，请稍候。');
  busy = true;
  try {
    if (!snapshot) await get();
    const signature = JSON.stringify({action,payload});
    // Retry an ambiguous network failure with exactly the same request ID and revision.
    if (pending && pending.signature !== signature) throw new Error('上次操作结果尚未确认，请点「确认上次操作」后继续。');
    if (!pending) pending = {signature,event:{action,payload,requestId:requestId(),expectedRevision:snapshot.revision}};
    const result = await invoke(pending.event);
    if (!result || !result.ok) {
      if (result && result.code === 'CONFLICT') { pending = null; await get(); }
      else if (result && result.code !== 'SERVICE_UNAVAILABLE') pending = null;
      throw new Error(result && result.message || '响应无效，请重试原操作。');
    }
    pending = null;
    snapshot = result.deleted ? null : result;
    try {
      if(action==='submit')saveWork(payload.stage,payload.answer);
      if(action==='reset'||action==='delete')clearLocal();
    } catch { result.localWarning='成绩已保存，但本机作品存储失败，请检查设备存储空间。'; }
    return result;
  } catch(error) {
    // Local validation/storage errors are definitive, not ambiguous network failures.
    if(config.demo)pending=null;
    throw error;
  } finally { busy = false; }
}
async function retryPending(){if(!pending)return get();const {action,payload}=pending.event;return mutate(action,payload);}
function hasPending(){return pending!==null;}
function saveWork(id,answer) { const data=local(); data.works[id]=answer; saveLocal(data); }
function clearLocal() { wx.removeStorageSync(LOCAL_KEY); Object.keys(drafts).forEach(k=>delete drafts[k]); }
module.exports = { get, mutate, retryPending, hasPending, local, saveLocal, saveWork, clearLocal, drafts, demo:config.demo };
