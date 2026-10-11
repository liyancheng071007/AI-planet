const config = require('./config');
App({
  globalData: { cloudReady:false },
  onLaunch() {
    if (!config.demo && config.envId && wx.cloud) {
      wx.cloud.init({env:config.envId,traceUser:false});
      this.globalData.cloudReady = true;
    }
  }
});
