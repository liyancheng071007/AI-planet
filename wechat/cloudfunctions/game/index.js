const cloud = require('wx-server-sdk');
const { createService } = require('./service');
cloud.init({ env:cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({throwOnNotFound:false});
const service = createService({
  async atomic(key, change) {
    const result = await db.runTransaction(async transaction => {
      const doc = transaction.collection('ai_planet_progress').doc(key);
      const found = await doc.get();
      const old = found.data || null;
      const {record,response} = change(old);
      if (record === null) {
        if (old) await doc.remove();
      } else {
        const {_id, ...data} = record;
        await doc.set({data});
      }
      return response;
    });
    return result;
  }
});
exports.main = async event => service(event,cloud.getWXContext());
