const crypto = require('node:crypto');
const { GameError, requireThat, transition, newState, award } = require('./domain');

const userKey = context => {
  requireThat(context && typeof context.OPENID === 'string' && context.OPENID && typeof context.APPID === 'string' && context.APPID, '必须从已登录的小程序调用。', 'UNAUTHENTICATED');
  return crypto.createHash('sha256').update(`${context.APPID}:${context.OPENID}`).digest('hex');
};
const view = (record, replay = false) => ({ ok:true, revision:record.revision, state:record.state, award:award(record.state), replay });

// store.atomic must commit the read + mutation together. No client-supplied user ID is used.
function createService(store, random = Math.random) {
  return async (event, context) => {
    try {
      const key = userKey(context);
      requireThat(event && typeof event === 'object' && !Array.isArray(event), '请求格式不正确。');
      requireThat(Buffer.byteLength(JSON.stringify(event),'utf8') <= 16000, '请求过大。');
      const action = event.action;
      requireThat(['get','settings','hint','assist','submit','reset','delete'].includes(action), '未知操作。');
      if (action !== 'get') {
        requireThat(typeof event.requestId === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(event.requestId), '缺少有效请求标识。');
        requireThat(Number.isSafeInteger(event.expectedRevision) && event.expectedRevision >= 0, '缺少存档版本。');
      }
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify({action, payload:event.payload || {}})).digest('hex');
      // Sample once per invocation, not once per transaction retry.
      const roll = random();
      return await store.atomic(key, old => {
        const record = old || { revision:0, state:newState(), requests:[] };
        if (action === 'get') return { record, response:view(record) };
        const previous = record.requests.find(r => r.id === event.requestId);
        if (previous) {
          requireThat(previous.fingerprint === fingerprint, '同一请求标识不能用于不同操作。', 'REQUEST_REUSED');
          return { record, response:view(record,true) };
        }
        requireThat(event.expectedRevision === record.revision, '存档已更新，请刷新后重试。', 'CONFLICT');
        if (action === 'delete') {
          requireThat(event.payload && event.payload.confirm === true, '请确认删除云端存档。');
          return { record:null, response:{ok:true, deleted:true} };
        }
        record.state = transition(record.state,event,() => roll);
        record.revision++;
        record.requests = [...record.requests,{id:event.requestId,fingerprint}].slice(-32);
        return { record, response:view(record) };
      });
    } catch (error) {
      if (error instanceof GameError) return {ok:false,code:error.code,message:error.message};
      // Do not return or log raw requests, OPENID, free text or provider errors.
      return {ok:false,code:'SERVICE_UNAVAILABLE',message:'云服务暂时不可用，请保留当前答案并稍后重试。'};
    }
  };
}
module.exports = { createService, userKey };
